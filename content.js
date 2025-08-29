// 拼多多商品聊天监听器 - Content Script
(function() {
    'use strict';

    // 全局状态管理
    let monitoringState = {
        isMonitoring: false,
        originalContent: null,
        currentContent: null,
        settings: null,
        refreshInterval: null,
        countdownTimer: null,
        lastCheckTime: 0,
        aiReplyInterval: 1, // AI回复间隔时间（分钟），默认1分钟
        // 新增：聊天监控状态
        chatMonitoring: {
            isActive: false,
            lastMessageCount: 0,
            lastMessageIds: new Set(),
            messageHistory: [],
            observer: null,
            // 新增：拼多多聊天页面特定的选择器
            selectors: {
                chatList: [
                    '#chat-detail-list',
                    '.chat-detail-list',
                    '.chat-list',
                    '.message-list',
                    '.chat-messages',
                    '.messages-container',
                    '[data-testid="chat-list"]',
                    '.chat-content',
                    '.chat-body'
                ],
                messageItem: [
                    '.chat-detail-item',
                    '.message-item',
                    '.chat-message',
                    '.message',
                    '.msg-item',
                    '[data-message]',
                    '.chat-item',
                    '.msg-detail-item'
                ],
                inputArea: [
                    '.chat-input-provider',
                    '.input-content-wrap',
                    '.chat-input',
                    '.message-input',
                    '.input-area',
                    '.chat-input-container'
                ]
            }
        },
        // 新增：API配置管理
        apiConfig: {
            endpoint: 'http://localhost:8090/api/chat/send',
            timeout: 15000, // 10秒超时
            maxRetries: 3,  // 最大重试次数
            retryDelay: 1000, // 重试延迟（毫秒）
            enabled: true,   // 是否启用API发送
            customHeaders: {}, // 自定义请求头
            messageFilter: {
                enabled: true, // 是否启用消息过滤
                keywords: ['客服', '客服人员', '在线客服'], // 客服关键词（备选方案）
                excludeKeywords: ['系统', '通知', '广告'], // 排除关键词
                // 新增：身份过滤配置
                roleFilter: {
                    enabled: true, // 是否启用身份过滤
                    sendServiceMessages: true, // 是否发送客服消息
                    sendCustomerMessages: false, // 是否发送客户消息
                    sendUnknownRoleMessages: false // 是否发送身份未知的消息
                }
            }
        },
        // 新增：拼多多聊天配置
        pddChatConfig: {
            pdduid: '', // 用户输入的pdduid
            enabled: true, // 是否启用拼多多聊天接口
            autoSend: true, // 是否自动发送AI回复
            aiReplyInterval: 1, // AI回复间隔时间（分钟）
            autoPaste: true, // 是否优先使用自动粘贴发送
            cookie: '', // 自动获取的cookie
            mallId: '', // 商城ID
            goodsId: '', // 商品ID
            autoGetCookie: true // 是否自动获取cookie
        }
    };

    // WxPusher Token (需要替换为你的实际Token)
    const WXPUSHER_TOKEN = 'AT_8MpSYYJLb4IdeauLitPIFgjblOe9WrPQ';

    // 新增：聊天消息结构
    class ChatMessage {
        constructor(id, content, timestamp, type = 'text') {
            this.id = id;
            this.content = content;
            this.timestamp = timestamp;
            this.type = type;
        }
    }

    // 新增：监控聊天列表变化
    function startChatMonitoring(options = {}) {
        const defaultOptions = {
            selector: '#chat-detail-list',
            checkInterval: 1000, // 检查间隔（毫秒）
            maxHistory: 100,     // 最大历史记录数
            notifyOnNewMessage: true,
            notifyOnMessageChange: true,
            ...options
        };

        // 检查 chatMonitoring 是否存在
        if (!monitoringState.chatMonitoring) {
            console.warn('chatMonitoring 未初始化，正在初始化...');
            // 初始化 chatMonitoring
            monitoringState.chatMonitoring = {
                isActive: false,
                lastMessageCount: 0,
                lastMessageIds: new Set(),
                messageHistory: [],
                observer: null,
                selectors: {
                    chatList: [
                        '#chat-detail-list',
                        '.chat-detail-list',
                        '.chat-list',
                        '.message-list',
                        '.chat-messages',
                        '.messages-container',
                        '[data-testid="chat-list"]',
                        '.chat-content',
                        '.chat-body'
                    ],
                    messageItem: [
                        '.chat-detail-item',
                        '.message-item',
                        '.chat-message',
                        '.message',
                        '.msg-item',
                        '[data-message]',
                        '.chat-item',
                        '.msg-detail-item'
                    ],
                    inputArea: [
                        '.chat-input-provider',
                        '.input-content-wrap',
                        '.chat-input',
                        '.message-input',
                        '.input-area',
                        '.chat-input-container'
                    ]
                }
            };
        }

        if (monitoringState.chatMonitoring.isActive) {
            console.log('聊天监控已在运行中');
            return { success: false, error: '聊天监控已在运行中' };
        }

        console.log('开始聊天监控:', defaultOptions);
        
        try {
            // 自动检测拼多多聊天页面
            const detectedSelectors = detectPddChatSelectors();
            if (detectedSelectors.chatList) {
                defaultOptions.selector = detectedSelectors.chatList;
                console.log('✅ 自动检测到聊天列表选择器:', defaultOptions.selector);
            }
            
            // 保存设置到全局状态
            monitoringState.settings = defaultOptions;
            
            // 初始化聊天监控状态
            monitoringState.chatMonitoring.isActive = true;
            monitoringState.chatMonitoring.lastMessageCount = 0;
            monitoringState.chatMonitoring.lastMessageIds.clear();
            monitoringState.chatMonitoring.messageHistory = [];

            // 方法1：使用 MutationObserver 监控DOM变化
            startMutationObserver(defaultOptions);

            // 方法2：使用定时器定期检查
            startPeriodicCheck(defaultOptions);

            // 方法3：监控新消息添加
            monitorNewMessages(defaultOptions);

            console.log('聊天监控启动成功');
            return { success: true };
        } catch (error) {
            console.error('启动聊天监控失败:', error);
            monitoringState.chatMonitoring.isActive = false;
            return { success: false, error: error.message };
        }
    }

    // 新增：自动检测拼多多聊天页面的选择器
    function detectPddChatSelectors() {
        console.log('🔍 开始检测拼多多聊天页面选择器...');
        
        const result = {
            chatList: null,
            messageItem: null,
            inputArea: null
        };
        
        // 检测聊天列表容器
        for (const selector of monitoringState.chatMonitoring.selectors.chatList) {
            const element = document.querySelector(selector);
            if (element) {
                result.chatList = selector;
                console.log('✅ 找到聊天列表容器:', selector, element);
                break;
            }
        }
        
        // 检测消息项元素
        for (const selector of monitoringState.chatMonitoring.selectors.messageItem) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                result.messageItem = selector;
                console.log('✅ 找到消息项元素:', selector, elements.length, '个');
                break;
            }
        }
        
        // 检测输入区域
        for (const selector of monitoringState.chatMonitoring.selectors.inputArea) {
            const element = document.querySelector(selector);
            if (element) {
                result.inputArea = selector;
                console.log('✅ 找到输入区域:', selector, element);
                break;
            }
        }
        
        // 如果没有找到标准选择器，尝试通用检测
        if (!result.chatList) {
            // 尝试查找包含消息的元素
            const possibleChatLists = document.querySelectorAll('[class*="chat"], [class*="message"], [class*="msg"]');
            for (const element of possibleChatLists) {
                if (element.children.length > 2 && element.scrollHeight > 200) {
                    result.chatList = `[class*="${element.className.split(' ')[0]}"]`;
                    console.log('✅ 通过通用检测找到聊天列表:', result.chatList, element);
                    break;
                }
            }
        }
        
        console.log('🔍 选择器检测结果:', result);
        return result;
    }

    // 使用 MutationObserver 监控DOM变化
    function startMutationObserver(options) {
        // 尝试多个选择器
        let targetNode = null;
        const selectors = [
            options.selector,
            ...monitoringState.chatMonitoring.selectors.chatList
        ];
        
        for (const selector of selectors) {
            targetNode = document.querySelector(selector);
            if (targetNode) {
                console.log('✅ 找到聊天列表元素:', selector);
                break;
            }
        }
        
        if (!targetNode) {
            console.warn('⚠️ 未找到聊天列表元素，尝试延迟检测...');
            // 延迟检测，等待页面加载
            setTimeout(() => {
                startMutationObserver(options);
            }, 2000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let hasNewMessages = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // 新增或删除子节点
                    const result = handleChatListMutation(mutation, options);
                    if (result && result.hasNewMessages) {
                        hasNewMessages = true;
                    }
                } else if (mutation.type === 'attributes') {
                    // 属性变化
                    handleAttributeMutation(mutation, options);
                }
            });
            
            if (hasNewMessages) {
                console.log('🔄 检测到新消息，更新消息计数');
                // 更新消息计数
                const currentMessages = getAllChatMessages(options.selector);
                monitoringState.chatMonitoring.lastMessageCount = currentMessages.length;
            }
        });

        // 配置观察选项
        const config = {
            childList: true,      // 观察子节点变化
            subtree: true,        // 观察所有后代节点
            attributes: true,     // 观察属性变化
            attributeFilter: ['class', 'style', 'data-*'] // 只观察特定属性
        };

        observer.observe(targetNode, config);
        monitoringState.chatMonitoring.observer = observer;

        console.log('✅ MutationObserver 已启动，监控元素:', targetNode);
        
        // 立即检查现有消息
        const existingMessages = getAllChatMessages(options.selector);
        monitoringState.chatMonitoring.lastMessageCount = existingMessages.length;
        console.log('📊 当前页面已有消息数量:', existingMessages.length);
    }

    // 处理聊天列表的DOM变化
    function handleChatListMutation(mutation, options) {
        const addedNodes = Array.from(mutation.addedNodes);
        const removedNodes = Array.from(mutation.removedNodes);
        let hasNewMessages = false;

        // 处理新增的消息
        addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // 使用动态检测的选择器
                let isMessageItem = false;
                
                // 检查是否是消息项
                for (const selector of monitoringState.chatMonitoring.selectors.messageItem) {
                    if (node.matches && node.matches(selector)) {
                        isMessageItem = true;
                        break;
                    }
                    if (node.classList) {
                        for (const className of node.classList) {
                            if (monitoringState.chatMonitoring.selectors.messageItem.some(s => 
                                s.includes(className) || className.includes('chat') || className.includes('message') || className.includes('msg'))) {
                                isMessageItem = true;
                                break;
                            }
                        }
                    }
                    if (isMessageItem) break;
                }
                
                // 如果没有匹配标准选择器，尝试通用检测
                if (!isMessageItem && node.classList) {
                    const classNames = Array.from(node.classList);
                    if (classNames.some(name => 
                        name.includes('chat') || name.includes('message') || name.includes('msg') || 
                        name.includes('item') || name.includes('detail'))) {
                        isMessageItem = true;
                        console.log('🔍 通过通用检测识别为消息项:', node.className);
                    }
                }
                
                if (isMessageItem) {
                    console.log('✅ 检测到新消息元素:', node);
                    const messageInfo = extractMessageInfo(node);
                    if (messageInfo) {
                        addNewMessage(messageInfo, options);
                        hasNewMessages = true;
                    }
                }
            }
        });

        // 处理删除的消息
        removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                node.classList && 
                node.classList.contains('chat-detail-item')) {
                
                console.log('消息被删除:', node.id || 'unknown');
            }
        });

        return { hasNewMessages };
    }

    // 处理属性变化
    function handleAttributeMutation(mutation, options) {
        if (mutation.target.classList && 
            mutation.target.classList.contains('chat-detail-item')) {
            
            const messageInfo = extractMessageInfo(mutation.target);
            if (messageInfo && options.notifyOnMessageChange) {
                console.log('消息属性变化:', messageInfo);
                notifyMessageChange(messageInfo, '属性变化');
            }
        }
    }

    // 提取消息信息
    function extractMessageInfo(messageElement) {
        try {
            if (!messageElement || !messageElement.nodeType) {
                return null;
            }

            // 生成唯一ID
            const id = messageElement.id || 
                      messageElement.getAttribute('data-id') || 
                      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 提取内容
            let content = '';
            if (messageElement.textContent) {
                content = cleanContent(messageElement.textContent);
            } else if (messageElement.innerText) {
                content = cleanContent(messageElement.innerText);
            } else if (messageElement.innerHTML) {
                content = cleanContent(messageElement.innerHTML);
            }
            
            if (!content || content.trim().length === 0) {
                return null; // 跳过空内容的消息
            }

            const timestamp = new Date().toISOString();
            
            // 尝试从元素中提取更多信息
            const timeSelectors = ['.time', '.timestamp', '[data-time]', '.msg-time', '.chat-time'];
            const senderSelectors = ['.sender', '.username', '[data-sender]', '.msg-sender', '.chat-sender'];
            const typeSelectors = ['.message-type', '[data-type]', '.msg-type'];

            let timeElement = null;
            let senderElement = null;
            let typeElement = null;

            for (const sel of timeSelectors) {
                timeElement = messageElement.querySelector(sel);
                if (timeElement) break;
            }

            for (const sel of senderSelectors) {
                senderElement = messageElement.querySelector(sel);
                if (senderElement) break;
            }

            for (const sel of typeSelectors) {
                typeElement = messageElement.querySelector(sel);
                if (typeElement) break;
            }

            // 新增：基于data-pin属性判别身份
            let role = 'unknown'; // 默认未知身份
            let isCustomer = false; // 是否为客户
            let isService = false;  // 是否为客服
            
            // 检查data-pin属性 - 根据实际DOM结构，data-pin位于.text元素上
            let dataPin = null;
            const textElement = messageElement.querySelector('.text');
            if (textElement) {
                dataPin = textElement.getAttribute('data-pin');
            }
            
            // 如果.text元素上没有找到，尝试在根元素上查找（兼容性考虑）
            if (dataPin === null) {
                dataPin = messageElement.getAttribute('data-pin');
            }
            
            if (dataPin !== null) {
                if (dataPin === '0') {
                    role = 'customer';
                    isCustomer = true;
                    isService = false;
                } else if (dataPin === '1') {
                    role = 'service';
                    isCustomer = false;
                    isService = true;
                }
            }
            
            // 如果没有data-pin属性，尝试从其他属性或内容推断身份
            if (role === 'unknown') {
                // 检查是否有其他身份标识属性
                const roleAttr = messageElement.getAttribute('data-role') || 
                               messageElement.getAttribute('data-type') ||
                               messageElement.getAttribute('data-sender-type');
                
                if (roleAttr) {
                    if (roleAttr.includes('customer') || roleAttr.includes('user') || roleAttr.includes('客户')) {
                        role = 'customer';
                        isCustomer = true;
                        isService = false;
                    } else if (roleAttr.includes('service') || roleAttr.includes('staff') || roleAttr.includes('客服')) {
                        role = 'service';
                        isCustomer = false;
                        isService = true;
                    }
                }
                
                // 如果仍然未知，尝试从发送者名称推断
                if (role === 'unknown' && senderElement) {
                    const senderName = cleanContent(senderElement.textContent);
                    if (senderName.includes('客服') || senderName.includes('在线客服') || senderName.includes('客服人员')) {
                        role = 'service';
                        isCustomer = false;
                        isService = true;
                    } else if (senderName.includes('客户') || senderName.includes('用户')) {
                        role = 'customer';
                        isCustomer = true;
                        isService = false;
                    }
                }
            }

            return {
                id: id,
                content: content,
                timestamp: timestamp,
                displayTime: timeElement ? cleanContent(timeElement.textContent) : '',
                sender: senderElement ? cleanContent(senderElement.textContent) : '',
                type: typeElement ? typeElement.getAttribute('data-type') || 'text' : 'text',
                element: messageElement,
                // 新增：身份相关信息
                role: role,
                isCustomer: isCustomer,
                isService: isService,
                dataPin: dataPin
            };
        } catch (error) {
            console.error('提取消息信息失败:', error);
            return null;
        }
    }

    // 添加新消息
    function addNewMessage(messageInfo, options) {
        if (!messageInfo || !messageInfo.id) {
            console.warn('无效的消息信息:', messageInfo);
            return;
        }

        // 检查是否是新消息
        if (monitoringState.chatMonitoring.lastMessageIds.has(messageInfo.id)) {
            console.log('跳过重复消息:', messageInfo.id);
            return;
        }

        // 添加到历史记录
        if (monitoringState.chatMonitoring.lastMessageIds) {
            monitoringState.chatMonitoring.lastMessageIds.add(messageInfo.id);
        }
        if (monitoringState.chatMonitoring.messageHistory) {
            monitoringState.chatMonitoring.messageHistory.push(messageInfo);
        }

        // 限制历史记录数量
        if (monitoringState.chatMonitoring.messageHistory && 
            monitoringState.chatMonitoring.messageHistory.length > options.maxHistory) {
            const removed = monitoringState.chatMonitoring.messageHistory.shift();
            if (removed && removed.id && monitoringState.chatMonitoring.lastMessageIds) {
                monitoringState.chatMonitoring.lastMessageIds.delete(removed.id);
            }
        }

        // 更新消息计数
        if (monitoringState.chatMonitoring.lastMessageCount !== undefined) {
            monitoringState.chatMonitoring.lastMessageCount++;
        }

        console.log('新消息:', messageInfo);

        // 发送通知
        if (options.notifyOnNewMessage) {
            notifyNewMessage(messageInfo);
        }

        // 发送到popup
        sendMessageToPopup({
            action: 'newChatMessage',
            message: messageInfo,
            totalCount: monitoringState.chatMonitoring.lastMessageCount || 0
        });

        // 更新popup状态
        sendMessageToPopup({
            action: 'updateChatStatus',
            isActive: true,
            status: `聊天监控运行中 - 消息数量: ${monitoringState.chatMonitoring.lastMessageCount || 0}`
        });

            // 新增：当监听到客服发来的消息后，准备自动回复
        if (monitoringState.settings?.autoReplyEnabled === 'true' && 
            messageInfo.isService) {
            console.log('检测到客服消息，准备自动回复');
            handleAutoReply(messageInfo);
        }

        // 新增：当监听到客服发来的消息后，向指定API接口发送消息
        if (shouldSendToAPI(messageInfo)) {
            console.log('检测到需要发送到API的消息:', messageInfo);
            sendCustomerMessageToAPI(messageInfo);
        }
    }

    // 通知新消息
    function notifyNewMessage(messageInfo) {
        const title = '新聊天消息';
        const content = `
发送者: ${messageInfo.sender || '未知'}
身份: ${messageInfo.role === 'service' ? '客服' : messageInfo.role === 'customer' ? '客户' : '未知'}
Data-Pin: ${messageInfo.dataPin || '未知'}
内容: ${messageInfo.content}
时间: ${messageInfo.displayTime || messageInfo.timestamp}
消息ID: ${messageInfo.id}`;

        console.log('通知新消息:', title, content);

        // 浏览器通知
        try {
            createBrowserNotification(title, content);
        } catch (error) {
            console.error('创建浏览器通知失败:', error);
        }

        // 窗口闪烁
        try {
            flashWindow();
        } catch (error) {
            console.error('窗口闪烁失败:', error);
        }

        // 外部通知
        if (monitoringState.settings?.wxPusherUid) {
            try {
                sendWxPusher(title, content, monitoringState.settings.wxPusherUid, monitoringState.settings.identity);
            } catch (error) {
                console.error('发送WxPusher通知失败:', error);
            }
        }

        if (monitoringState.settings?.feishuWebhook) {
            try {
                sendFeishuMessage(
                    monitoringState.settings.feishuWebhook,
                    title,
                    content,
                    monitoringState.settings.identity
                );
            } catch (error) {
                console.error('发送飞书通知失败:', error);
            }
        }
    }

    // 通知消息变化
    function notifyMessageChange(messageInfo, changeType) {
        const title = '聊天消息变化';
        const content = `
变化类型: ${changeType}
消息ID: ${messageInfo.id}
内容: ${messageInfo.content}
时间: ${messageInfo.displayTime || messageInfo.timestamp}`;

        console.log(title, content);
    }

    // 使用定时器定期检查
    function startPeriodicCheck(options) {
        const checkInterval = setInterval(() => {
            if (!monitoringState.chatMonitoring.isActive) {
                clearInterval(checkInterval);
                return;
            }

            try {
                const currentMessages = getAllChatMessages(options.selector);
                const currentCount = currentMessages.length;

                // 检查消息数量变化
                if (currentCount !== (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                    console.log(`消息数量变化: ${monitoringState.chatMonitoring.lastMessageCount || 0} -> ${currentCount}`);
                    
                    if (currentCount > (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                        // 有新消息
                        const newMessages = currentMessages.slice(monitoringState.chatMonitoring.lastMessageCount || 0);
                        newMessages.forEach(messageInfo => {
                            if (messageInfo) {
                                addNewMessage(messageInfo, options);
                            }
                        });
                    }
                    
                    monitoringState.chatMonitoring.lastMessageCount = currentCount;
                }
            } catch (error) {
                console.error('定时检查出错:', error);
            }
        }, options.checkInterval);

        console.log('定时检查已启动，间隔:', options.checkInterval, 'ms');
    }

    // 获取所有聊天消息
    function getAllChatMessages(selector) {
        try {
            // 首先尝试找到聊天容器
            let chatContainer = null;
            const selectors = [
                selector,
                ...monitoringState.chatMonitoring.selectors.chatList
            ];
            
            for (const sel of selectors) {
                chatContainer = document.querySelector(sel);
                if (chatContainer) {
                    break;
                }
            }
            
            if (!chatContainer) {
                console.warn('⚠️ 未找到聊天容器，尝试通用检测...');
                // 尝试通用检测
                const possibleContainers = document.querySelectorAll('[class*="chat"], [class*="message"], [class*="msg"]');
                for (const container of possibleContainers) {
                    if (container.children.length > 2 && container.scrollHeight > 200) {
                        chatContainer = container;
                        console.log('✅ 通过通用检测找到聊天容器:', container.className);
                        break;
                    }
                }
            }
            
            if (!chatContainer) {
                console.warn('⚠️ 未找到聊天容器');
                return [];
            }

            // 尝试多种可能的消息元素选择器
            const messageSelectors = [
                ...monitoringState.chatMonitoring.selectors.messageItem,
                '.chat-detail-item',
                '.message-item',
                '.chat-message',
                '.message',
                '[data-message]',
                '.msg-item'
            ];

            let messageElements = [];
            for (const sel of messageSelectors) {
                messageElements = chatContainer.querySelectorAll(sel);
                if (messageElements.length > 0) {
                    break;
                }
            }
            
            // 如果没有找到标准消息元素，尝试通用检测
            if (messageElements.length === 0) {
                console.log('🔍 尝试通用消息检测...');
                const allChildren = Array.from(chatContainer.children);
                messageElements = allChildren.filter(child => {
                    if (child.nodeType !== Node.ELEMENT_NODE) return false;
                    
                    const classNames = Array.from(child.classList || []);
                    const hasMessageClass = classNames.some(name => 
                        name.includes('chat') || name.includes('message') || name.includes('msg') ||
                        name.includes('item') || name.includes('detail')
                    );
                    
                    const hasTextContent = child.textContent && child.textContent.trim().length > 0;
                    const hasReasonableSize = child.offsetHeight > 20 && child.offsetWidth > 100;
                    
                    return hasMessageClass && hasTextContent && hasReasonableSize;
                });
                
                if (messageElements.length > 0) {
                    console.log('✅ 通过通用检测找到消息元素:', messageElements.length, '个');
                }
            }

            const messages = [];
            messageElements.forEach((element, index) => {
                const messageInfo = extractMessageInfo(element);
                if (messageInfo) {
                    messages.push(messageInfo);
                }
            });

            return messages;
        } catch (error) {
            console.error('获取聊天消息失败:', error);
            return [];
        }
    }

    // 监控新消息添加
    function monitorNewMessages(options) {
        console.log('🔍 开始监控新消息添加...');
        
        // 使用动态检测的选择器查找输入框
        let chatInput = null;
        const inputSelectors = [
            ...monitoringState.chatMonitoring.selectors.inputArea,
            '.chat-input-provider input',
            '.chat-input-provider textarea',
            '.input-content-wrap input',
            '.input-content-wrap textarea',
            'input[type="text"]',
            'textarea',
            '.chat-input',
            '.message-input'
        ];
        
        for (const selector of inputSelectors) {
            chatInput = document.querySelector(selector);
            if (chatInput) {
                console.log('✅ 找到聊天输入框:', selector);
                break;
            }
        }
        
        if (chatInput) {
            // 监听聊天输入框的提交事件
            chatInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    console.log('🔍 检测到聊天输入提交');
                    // 延迟检查，等待消息被添加到列表
                    setTimeout(() => {
                        const currentMessages = getAllChatMessages(options.selector);
                        if (currentMessages.length > (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                            console.log('✅ 检测到新消息通过输入框添加');
                        }
                    }, 500);
                }
            });
            
            // 监听输入事件
            chatInput.addEventListener('input', (event) => {
                console.log('🔍 检测到输入框内容变化:', event.target.value);
            });
        } else {
            console.warn('⚠️ 未找到聊天输入框');
        }

        // 使用动态检测的选择器查找发送按钮
        let sendButton = null;
        const buttonSelectors = [
            '.chat-input-provider button',
            '.chat-input-provider [data-action="send"]',
            '.input-content-wrap button',
            '.send-button',
            '.ct-operate-btn',
            '.extra-button',
            'button[type="submit"]',
            '[data-action="send"]'
        ];
        
        for (const selector of buttonSelectors) {
            sendButton = document.querySelector(selector);
            if (sendButton) {
                console.log('✅ 找到发送按钮:', selector);
                break;
            }
        }
        
        if (sendButton) {
            // 监听发送按钮点击
            sendButton.addEventListener('click', () => {
                console.log('🔍 检测到发送按钮点击');
                setTimeout(() => {
                    const currentMessages = getAllChatMessages(options.selector);
                    if (currentMessages.length > (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                        console.log('✅ 检测到新消息通过按钮发送');
                    }
                }, 500);
            });
        } else {
            console.warn('⚠️ 未找到发送按钮');
        }
        
        // 监听整个页面的点击事件，检测可能的发送操作
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                const buttonText = target.textContent || target.innerText || '';
                if (buttonText.includes('发送') || buttonText.includes('Send') || 
                    target.getAttribute('aria-label')?.includes('发送') ||
                    target.getAttribute('title')?.includes('发送')) {
                    console.log('🔍 检测到可能的发送按钮点击:', buttonText);
                    setTimeout(() => {
                        const currentMessages = getAllChatMessages(options.selector);
                        if (currentMessages.length > (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                            console.log('✅ 检测到新消息通过发送按钮添加');
                        }
                    }, 500);
                }
            }
        });
        
        console.log('✅ 新消息监控已启动');
    }

    // 停止聊天监控
    function stopChatMonitoring() {
        // 检查 chatMonitoring 是否存在
        if (!monitoringState.chatMonitoring || !monitoringState.chatMonitoring.isActive) {
            return;
        }

        console.log('停止聊天监控');

        // 停止 MutationObserver
        if (monitoringState.chatMonitoring.observer) {
            monitoringState.chatMonitoring.observer.disconnect();
            monitoringState.chatMonitoring.observer = null;
        }

        // 重置状态
        monitoringState.chatMonitoring.isActive = false;
        monitoringState.chatMonitoring.lastMessageCount = 0;
        if (monitoringState.chatMonitoring.lastMessageIds) {
            monitoringState.chatMonitoring.lastMessageIds.clear();
        }
        if (monitoringState.chatMonitoring.messageHistory) {
            monitoringState.chatMonitoring.messageHistory = [];
        }

        console.log('聊天监控已停止');
    }

    // 获取聊天监控状态
    function getChatMonitoringStatus() {
        // 检查 chatMonitoring 是否存在
        if (!monitoringState.chatMonitoring) {
            return {
                isActive: false,
                messageCount: 0,
                historyCount: 0,
                lastMessage: null
            };
        }
        
        return {
            isActive: monitoringState.chatMonitoring.isActive || false,
            messageCount: monitoringState.chatMonitoring.lastMessageCount || 0,
            historyCount: monitoringState.chatMonitoring.messageHistory ? monitoringState.chatMonitoring.messageHistory.length : 0,
            lastMessage: monitoringState.chatMonitoring.messageHistory && monitoringState.chatMonitoring.messageHistory.length > 0 ? 
                monitoringState.chatMonitoring.messageHistory[monitoringState.chatMonitoring.messageHistory.length - 1] : null
        };
    }

    // 获取聊天历史记录
    function getChatHistory(limit = 50) {
        if (!monitoringState.chatMonitoring || !monitoringState.chatMonitoring.messageHistory) {
            return [];
        }
        return monitoringState.chatMonitoring.messageHistory.slice(-limit);
    }

    // 隐藏页面内容（静默模式）
    function hidePageContent() {
        try {
            // 隐藏页面主要内容，只保留必要的监听功能
            const body = document.body;
            if (body) {
                // 创建隐藏样式
                const style = document.createElement('style');
                style.id = 'pdd-silent-mode-style';
                style.textContent = `
                    body > *:not(#pdd-monitor-container) {
                        display: none !important;
                    }
                    #pdd-monitor-container {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        background: transparent !important;
                        z-index: 999999 !important;
                        pointer-events: none !important;
                    }
                    .pdd-monitor-status {
                        position: fixed !important;
                        top: 10px !important;
                        right: 10px !important;
                        background: rgba(0,0,0,0.8) !important;
                        color: white !important;
                        padding: 5px 10px !important;
                        border-radius: 5px !important;
                        font-size: 12px !important;
                        z-index: 1000000 !important;
                        pointer-events: none !important;
                    }
                `;
                
                // 移除已存在的样式
                const existingStyle = document.getElementById('pdd-silent-mode-style');
                if (existingStyle) {
                    existingStyle.remove();
                }
                
                document.head.appendChild(style);
                
                // 创建监控状态显示容器
                let statusContainer = document.getElementById('pdd-monitor-container');
                if (!statusContainer) {
                    statusContainer = document.createElement('div');
                    statusContainer.id = 'pdd-monitor-container';
                    document.body.appendChild(statusContainer);
                }
                
                // 显示监控状态
                const statusDiv = document.createElement('div');
                statusDiv.className = 'pdd-monitor-status';
                statusDiv.textContent = '🔄 拼多多聊天监控运行中...';
                statusContainer.appendChild(statusDiv);
                
                console.log('页面内容已隐藏，进入静默监控模式');
            }
        } catch (error) {
            console.error('隐藏页面内容失败:', error);
        }
    }

    // 工具函数：清理内容
    function cleanContent(content) {
        if (!content) return '';
        return content
            .replace(/<[^>]+>/g, '')           // 移除HTML标签
            .replace(/&nbsp;/g, ' ')           // 替换HTML实体
            .replace(/&amp;/g, '&')            // 替换HTML实体
            .replace(/&lt;/g, '<')             // 替换HTML实体
            .replace(/&gt;/g, '>')             // 替换HTML实体
            .replace(/&quot;/g, '"')           // 替换HTML实体
            .replace(/\s+/g, ' ')             // 合并多个空格
            .trim();                           // 移除首尾空格
    }

    // 工具函数：获取页面内容
    function getPageContent(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                return null;
            }

            let allContent = '';
            elements.forEach((element, index) => {
                const content = cleanContent(element.textContent || element.innerText);
                if (content) {
                    allContent += (index > 0 ? '\n' : '') + content;
                }
            });

            return allContent || null;
        } catch (error) {
            console.error('获取页面内容失败:', error);
            return null;
        }
    }

    // 工具函数：等待页面加载
    function waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve(true);
                return;
            }

            const timeout = setTimeout(() => resolve(false), 30000);
            window.addEventListener('load', () => {
                clearTimeout(timeout);
                resolve(true);
            }, { once: true });
        });
    }

    // 工具函数：倒计时
    function countdown(seconds, callback) {
        return new Promise((resolve, reject) => {
            let timeLeft = seconds;
            
            if (monitoringState.countdownTimer) {
                clearInterval(monitoringState.countdownTimer);
            }

            monitoringState.countdownTimer = setInterval(() => {
                if (!monitoringState.isMonitoring) {
                    clearInterval(monitoringState.countdownTimer);
                    monitoringState.countdownTimer = null;
                    reject(new Error('监控已停止'));
                    return;
                }

                if (callback) {
                    callback(timeLeft);
                }

                timeLeft--;
                if (timeLeft < 0) {
                    clearInterval(monitoringState.countdownTimer);
                    monitoringState.countdownTimer = null;
                    resolve();
                }
            }, 1000);
        });
    }

    // 工具函数：发送消息到popup
    async function sendMessageToPopup(message) {
        try {
            if (chrome.runtime?.id) {
                await chrome.runtime.sendMessage(message);
            }
        } catch (error) {
            console.error('发送消息到popup失败:', error);
        }
    }

    // 工具函数：创建浏览器通知
    async function createBrowserNotification(title, message) {
        try {
            // 检查浏览器通知权限
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body: message });
            } else if ('Notification' in window && Notification.permission === 'default') {
                // 请求权限
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification(title, { body: message });
                }
            }
        } catch (error) {
            console.error('创建浏览器通知失败:', error);
        }
    }

    // 工具函数：窗口闪烁
    async function flashWindow() {
        try {
            // 简单的窗口闪烁效果
            if (document.title) {
                const originalTitle = document.title;
                document.title = '🔔 新消息!';
                setTimeout(() => {
                    document.title = originalTitle;
                }, 1000);
            }
        } catch (error) {
            console.error('窗口闪烁失败:', error);
        }
    }

    // 工具函数：发送WxPusher通知
    async function sendWxPusher(title, content, uid, identity = '') {
        try {
            if (!uid || !WXPUSHER_TOKEN) return false;

            const message = {
                appToken: WXPUSHER_TOKEN,
                content: `${identity ? `[${identity}] ` : ''}${title}\n\n${content}`,
                contentType: 1,
                uids: [uid]
            };

            const response = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('发送WxPusher通知失败:', error);
            return false;
        }
    }

    // 工具函数：发送飞书通知
    async function sendFeishuMessage(webhook, title, content, identity = '') {
        try {
            if (!webhook) return false;

            const message = {
                msg_type: "text",
                content: {
                    text: `${identity ? `[${identity}] ` : ''}${title}\n\n${content}`
                }
            };

            const response = await fetch(webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });

            return response.ok;
        } catch (error) {
            console.error('发送飞书通知失败:', error);
            return false;
        }
    }

    // 核心功能：检查内容变化
    async function checkContentChange() {
        try {
            if (!monitoringState.isMonitoring || !monitoringState.settings) {
                return false;
            }

            const currentContent = getPageContent(monitoringState.settings.selector);
            if (!currentContent) {
                console.warn('未找到监控元素内容');
                return false;
            }

            // 更新当前内容
            monitoringState.currentContent = currentContent;

            // 发送内容更新消息
            await sendMessageToPopup({
                action: 'updateContent',
                current: currentContent
            });

            // 检查是否有变化
            if (monitoringState.originalContent && currentContent !== monitoringState.originalContent) {
                console.log('检测到内容变化!');
                
                const changeMessage = monitoringState.settings.continuousMode ? 
                    '检测到内容变化，持续监控模式已启用' : 
                    '检测到内容变化，监控已停止';

                const detailMessage = `
原始内容：${monitoringState.originalContent}
当前内容：${currentContent}
发生时间：${new Date().toLocaleString()}
监控网址：${window.location.href}
${monitoringState.settings.continuousMode ? '已自动更新原始内容，继续监控中...' : '监控已停止'}`;

                // 发送通知
                await createBrowserNotification(
                    monitoringState.settings.continuousMode ? '监控内容发生变化-持续监控' : '监控内容发生变化-停止监控',
                    `${monitoringState.settings.identity ? `[${monitoringState.settings.identity}] ` : ''}${changeMessage}\n${detailMessage}`
                );

                // 窗口闪烁
                await flashWindow();

                // 发送外部通知
                if (monitoringState.settings.wxPusherUid) {
                    await sendWxPusher(
                        '监控内容发生变化',
                        detailMessage,
                        monitoringState.settings.wxPusherUid,
                        monitoringState.settings.identity
                    );
                }

                if (monitoringState.settings.feishuWebhook) {
                    await sendFeishuMessage(
                        monitoringState.settings.feishuWebhook,
                        '监控内容发生变化',
                        detailMessage,
                        monitoringState.settings.identity
                    );
                }

                if (monitoringState.settings.continuousMode) {
                    // 持续监控模式：更新原始内容
                    monitoringState.originalContent = currentContent;
                    await sendMessageToPopup({
                        action: 'updateContent',
                        original: currentContent
                    });
                    return false; // 继续监控
                } else {
                    // 单次监控模式：停止监控
                    await stopMonitoring('检测到内容变化');
                    return true; // 停止监控
                }
            }

            return false;
        } catch (error) {
            console.error('检查内容变化失败:', error);
            return false;
        }
    }

    // 核心功能：开始监控
    async function startMonitoring(settings) {
        try {
            console.log('开始监控，设置:', settings);

            // 等待页面加载
            const isLoaded = await waitForPageLoad();
            if (!isLoaded) {
                throw new Error('页面加载超时');
            }

            // 获取初始内容
            const initialContent = getPageContent(settings.selector);
            if (!initialContent) {
                throw new Error('未找到监控元素，请检查选择器');
            }

            // 初始化监控状态
            monitoringState = {
                isMonitoring: true,
                originalContent: initialContent,
                currentContent: initialContent,
                settings: settings,
                refreshInterval: null,
                countdownTimer: null,
                lastCheckTime: Date.now()
            };

            // 更新popup显示
            await sendMessageToPopup({
                action: 'updateContent',
                original: initialContent,
                current: initialContent
            });

            // 等待指定时间后开始监控循环
            await countdown(settings.waitTime, (timeLeft) => {
                sendMessageToPopup({
                    action: 'updateCountdown',
                    timeLeft: timeLeft
                });
            });

            if (!monitoringState.isMonitoring) return { success: false };

            // 启动监控循环
            startMonitoringLoop();

            return { success: true };
        } catch (error) {
            console.error('启动监控失败:', error);
            return { error: error.message };
        }
    }

    // 核心功能：监控循环
    async function startMonitoringLoop() {
        while (monitoringState.isMonitoring) {
            try {
                // 检查内容变化
                const shouldStop = await checkContentChange();
                if (shouldStop) {
                    break;
                }

                // 等待下次检查
                const interval = monitoringState.settings.interval;
                await countdown(interval, (timeLeft) => {
                    sendMessageToPopup({
                        action: 'updateCountdown',
                        timeLeft: timeLeft
                    });
                });

                if (!monitoringState.isMonitoring) break;

                // 更新最后检查时间
                monitoringState.lastCheckTime = Date.now();

            } catch (error) {
                console.error('监控循环错误:', error);
                if (error.message === '监控已停止') {
                    break;
                }
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    // 核心功能：停止监控
    async function stopMonitoring(reason = '手动停止') {
        try {
            console.log('停止监控，原因:', reason);

            monitoringState.isMonitoring = false;

            // 清除计时器
            if (monitoringState.countdownTimer) {
                clearInterval(monitoringState.countdownTimer);
                monitoringState.countdownTimer = null;
            }

            if (monitoringState.refreshInterval) {
                clearInterval(monitoringState.refreshInterval);
                monitoringState.refreshInterval = null;
            }

            // 更新popup显示
            await sendMessageToPopup({
                action: 'updateStatus',
                isActive: false,
                status: '监控已停止'
            });

            await sendMessageToPopup({
                action: 'updateCountdown',
                timeLeft: null
            });

            // 保存监控状态
            await chrome.storage.local.set({
                pddMonitorState: {
                    isMonitoring: false,
                    lastStopTime: Date.now(),
                    reason: reason
                }
            });

            return { success: true };
        } catch (error) {
            console.error('停止监控失败:', error);
            return { error: error.message };
        }
    }

    // 核心功能：测试选择器
    function testSelector(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                return { success: false, error: '未找到匹配的元素' };
            }

            const content = getPageContent(selector);
            return {
                success: true,
                count: elements.length,
                content: content
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 消息监听器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到消息:', message);

        if (message.action === 'startMonitoring') {
            Promise.resolve()
                .then(async () => {
                    try {
                        const result = await startMonitoring(message.settings);
                        sendResponse(result);
                    } catch (error) {
                        sendResponse({ error: error.message });
                    }
                });
            return true;
        }

        if (message.action === 'stopMonitoring') {
            Promise.resolve()
                .then(async () => {
                    try {
                        const result = await stopMonitoring('手动停止');
                        sendResponse(result);
                    } catch (error) {
                        sendResponse({ error: error.message });
                    }
                });
            return true;
        }

        if (message.action === 'testSelector') {
            const result = testSelector(message.selector);
            sendResponse(result);
            return false;
        }

        if (message.action === 'checkMonitoringStatus') {
            sendResponse({
                isMonitoring: monitoringState.isMonitoring,
                originalContent: monitoringState.originalContent,
                currentContent: monitoringState.currentContent,
                settings: monitoringState.settings
            });
            return false;
        }

        // 新增：聊天监控相关消息处理
        if (message.action === 'startChatMonitoring') {
            try {
                const result = startChatMonitoring(message.options);
                sendResponse({ success: result });
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }

        if (message.action === 'stopChatMonitoring') {
            try {
                stopChatMonitoring();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }

        if (message.action === 'getChatMonitoringStatus') {
            try {
                const status = getChatMonitoringStatus();
                sendResponse(status);
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }

        if (message.action === 'getChatHistory') {
            try {
                const history = getChatHistory(message.limit || 50);
                sendResponse({ history: history });
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }

        // 新增：隐藏页面内容（静默模式）
        if (message.action === 'hidePageContent') {
            try {
                if (message.silentMode) {
                    hidePageContent();
                }
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }

        return false;
    });

    // 页面加载完成后尝试恢复监控
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // 检查是否有保存的监控状态
            const result = await chrome.storage.local.get('pddMonitorState');
            if (result.pddMonitorState && result.pddMonitorState.isMonitoring) {
                console.log('检测到保存的监控状态，尝试恢复...');
                // 这里可以添加恢复监控的逻辑
            }
        } catch (error) {
            console.error('恢复监控状态失败:', error);
        }
    });

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        if (monitoringState.countdownTimer) {
            clearInterval(monitoringState.countdownTimer);
        }
        if (monitoringState.refreshInterval) {
            clearInterval(monitoringState.refreshInterval);
        }
        // 清理聊天监控
        if (monitoringState.chatMonitoring.isActive) {
            stopChatMonitoring();
        }
    });

    // 自动回复处理函数
    async function handleAutoReply(messageInfo) {
        try {
            if (!monitoringState.settings?.apiEndpoint) {
                console.warn('未配置API端点，跳过自动回复');
                return;
            }

            console.log('开始处理自动回复:', messageInfo);

            // 发送消息到后端API
            const apiResponse = await sendMessageToAPI(messageInfo);
            
            if (apiResponse && apiResponse.success) {
                console.log('收到API回复:', apiResponse.message);
                
                // 根据设置的AI回复间隔时间延迟发送
                const intervalMinutes = monitoringState.aiReplyInterval || 1;
                const intervalMs = intervalMinutes * 60 * 1000; // 转换为毫秒
                
                console.log(`⏱️ 将在 ${intervalMinutes} 分钟后发送AI回复给客服`);
                
                // 延迟发送回复
                setTimeout(() => {
                    sendReplyToCustomer(apiResponse.message);
                }, intervalMs);
            } else {
                console.warn('API回复失败:', apiResponse?.error || '未知错误');
            }
        } catch (error) {
            console.error('自动回复处理失败:', error);
        }
    }

    // 发送消息到后端API
    async function sendMessageToAPI(messageInfo) {
        try {
            const apiEndpoint = monitoringState.settings.apiEndpoint;
            
            // 从页面标题中提取店名
            const storeName = extractStoreNameFromTitle(document.title);
            
            // 构造对话历史格式
            const conversationHistory = buildConversationHistory();
            const formattedMessage = conversationHistory || `${storeName}网店客服发来信息：${messageInfo.content}`;
            
            const requestData = {
                message: formattedMessage,
                messageType: conversationHistory ? 'conversation' : 'single',
                originalMessage: messageInfo.content, // 保留原始消息
                conversationCount: conversationHistory ? conversationHistory.split('\n').length : 1,
                storeName: storeName, // 单独提供店名
                sender: messageInfo.sender,
                timestamp: messageInfo.timestamp,
                messageId: messageInfo.id,
                url: window.location.href,
                title: document.title
            };

            console.log('发送到API:', apiEndpoint, requestData);

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('API响应:', result);
            return result;
        } catch (error) {
            console.error('发送消息到API失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 发送回复给客服
    function sendReplyToCustomer(replyText) {
        try {
            if (!monitoringState.settings?.autoReplyToCustomer) {
                console.log('自动回复已禁用，跳过发送');
                return;
            }

            // 查找输入框
            const inputSelector = 'input[type="text"], input-content-wrap, input-content';
            const inputElement = document.querySelector(inputSelector);
            
            if (!inputElement) {
                console.warn('未找到输入框，无法发送回复');
                return;
            }

            // 处理自定义回复模板
            let finalReply = replyText;
            if (monitoringState.settings.customReplyTemplate) {
                finalReply = monitoringState.settings.customReplyTemplate
                    .replace('{message}', replyText)
                    .replace('{time}', new Date().toLocaleString());
            }

            console.log('发送回复:', finalReply);

            // 设置输入框的值
            inputElement.value = finalReply;
            
            // 触发输入事件
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));

            // 查找发送按钮并点击
            const sendButtonSelector = 'button[type="submit"], send-button, .submit-btn, [data-action="send"]';
            const sendButton = document.querySelector(sendButtonSelector);
            
            if (sendButton) {
                // 延迟点击发送按钮
                setTimeout(() => {
                    sendButton.click();
                    console.log('回复已发送');
                }, 500);
            } else {
                // 如果没有找到发送按钮，尝试按回车键
                inputElement.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
                console.log('通过回车键发送回复');
            }

        } catch (error) {
            console.error('发送回复失败:', error);
        }
    }

    // 新增：向指定API接口发送客服消息
    async function sendCustomerMessageToAPI(messageInfo) {
        const maxRetries = monitoringState.apiConfig.maxRetries;
        let retryCount = 0;
        
        while (retryCount <= maxRetries) {
            try {
                console.log(`尝试发送消息到API (第${retryCount + 1}次):`, messageInfo.content);
                
                const result = await sendMessageWithTimeout(messageInfo, retryCount);
                
                if (result.success) {
                    console.log('API消息发送成功:', result.response);
                    
                    // 解析API响应，提取message字段
                    try {
                        const apiResponse = JSON.parse(result.response);
                        if (apiResponse.status === 'success' && apiResponse.message) {
                            console.log('提取到AI回复:', apiResponse.message);
                            
                            // 根据设置的间隔时间延迟发送
                            const intervalMinutes = monitoringState.aiReplyInterval || 1;
                            const intervalMs = intervalMinutes * 60 * 1000; // 转换为毫秒
                            
                            console.log(`⏱️ 将在 ${intervalMinutes} 分钟后发送AI回复给客服`);
                            
                            // 延迟发送AI回复
                            setTimeout(async () => {
                                try {
                                    // 优先使用自动粘贴发送方式
                                    const autoSendResult = await autoPasteAndSendMessage(apiResponse.message);
                                    if (autoSendResult.success) {
                                        console.log('✅ 自动粘贴发送成功');
                                    } else {
                                        console.warn('⚠️ 自动粘贴发送失败，回退到API发送:', autoSendResult.error);
                                        // 回退到API发送
                                        await sendAIMessageToPddChat(apiResponse.message);
                                    }
                                } catch (autoSendError) {
                                    console.error('❌ 自动粘贴发送异常，回退到API发送:', autoSendError);
                                    // 回退到API发送
                                    await sendAIMessageToPddChat(apiResponse.message);
                                }
                            }, intervalMs);
                        } else {
                            console.warn('API响应格式不正确或没有message字段:', apiResponse);
                        }
                    } catch (parseError) {
                        console.error('解析API响应失败:', parseError);
                    }
                    
                    // 发送成功通知
                    await sendMessageToPopup({
                        action: 'apiMessageSent',
                        success: true,
                        message: messageInfo.content,
                        response: result.response,
                        retryCount: retryCount
                    });
                    
                    return result;
                } else {
                    throw new Error(result.error);
                }
                
            } catch (error) {
                retryCount++;
                console.error(`API发送失败 (第${retryCount}次):`, error.message);
                
                if (retryCount <= maxRetries) {
                    console.log(`等待${monitoringState.apiConfig.retryDelay}ms后重试...`);
                    await delay(monitoringState.apiConfig.retryDelay);
                } else {
                    console.error('达到最大重试次数，发送失败');
                    
                    // 发送失败通知
                    await sendMessageToPopup({
                        action: 'apiMessageSent',
                        success: false,
                        message: messageInfo.content,
                        error: error.message,
                        retryCount: retryCount - 1
                    });
                    
                    return { success: false, error: error.message, retryCount: retryCount - 1 };
                }
            }
        }
    }

    // 带超时的消息发送
    async function sendMessageWithTimeout(messageInfo, retryCount) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), monitoringState.apiConfig.timeout);
        
        try {
            const apiEndpoint = monitoringState.apiConfig.endpoint;
            
            // 构建请求头
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'PddChatMonitor/2.1.0',
                'X-Message-ID': messageInfo.id,
                'X-Timestamp': messageInfo.timestamp,
                'X-Sender': messageInfo.sender || 'unknown',
                'X-Retry-Count': retryCount.toString(),
                // 新增：身份相关信息
                'X-Message-Role': messageInfo.role || 'unknown',
                'X-Is-Service': messageInfo.isService ? 'true' : 'false',
                'X-Is-Customer': messageInfo.isCustomer ? 'true' : 'false',
                'X-Data-Pin': messageInfo.dataPin || 'unknown',
                ...monitoringState.apiConfig.customHeaders
            };
            
            // 构建请求体 - 改为发送对话历史
            const conversationHistory = buildConversationHistory();
            const requestData = conversationHistory || messageInfo.content; // 如果没有对话历史，回退到单条消息
            
            console.log('发送请求到API:', {
                endpoint: apiEndpoint,
                headers: headers,
                body: requestData,
                retryCount: retryCount,
                messageType: conversationHistory ? '对话历史' : '单条消息'
            });

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    message: requestData,
                    messageType: conversationHistory ? 'conversation' : 'single',
                    originalMessage: messageInfo.content, // 保留原始单条消息
                    conversationCount: conversationHistory ? requestData.split('\n').length : 1
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.text();
            console.log('API响应:', result);
            
            return { success: true, response: result };
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`请求超时 (${monitoringState.apiConfig.timeout}ms)`);
            }
            
            throw error;
        }
    }

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 新增：查找拼多多聊天页面的发送按钮
    function findPddChatSendButton() {
        // 基于图片中显示的实际DOM结构，查找发送按钮
        const sendButtonSelectors = [
            // 图片中显示的实际发送按钮选择器
            '.send-button', // 优先使用图片中显示的发送按钮
            '.input-content-wrap + .send-button',
            '.input-content-wrap ~ .send-button',
            // 备用选择器
            '.ct-operate-btn.extra-button',
            '.ct-operate-btn',
            '.extra-button',
            '.send-btn',
            '.chat-send-btn', 
            '.message-send-btn',
            '[data-action="send"]',
            '[data-testid="send"]',
            // 通用选择器
            'button[type="submit"]',
            '#send-btn',
            '[data-testid="send-button"]',
            '.chat-send',
            '.message-send'
        ];
        
        for (const selector of sendButtonSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // 检查按钮是否可见 - 对于图标按钮，主要检查可见性
                    if (element.offsetParent !== null && 
                        element.style.display !== 'none' && 
                        element.style.visibility !== 'hidden') {
                        
                        // 对于 send-button 类的按钮，直接认为是发送按钮
                        if (element.classList.contains('send-button')) {
                            console.log('✅ 找到拼多多聊天发送按钮:', {
                                selector: selector,
                                element: element,
                                textContent: element.textContent,
                                className: element.className,
                                id: element.id,
                                dataActive: element.getAttribute('data-active')
                            });
                            return element;
                        }
                        
                        // 对于 ct-operate-btn 类的按钮，作为备用选择器
                        if (element.classList.contains('ct-operate-btn') || 
                            element.classList.contains('extra-button')) {
                            console.log('✅ 找到备用发送按钮:', {
                                selector: selector,
                                element: element,
                                textContent: element.textContent,
                                className: element.className,
                                id: element.id
                            });
                            return element;
                        }
                        
                        // 对于其他按钮，检查是否包含发送相关文本
                        if (element.textContent.includes('发送') || 
                            element.textContent.includes('Send') ||
                            element.getAttribute('aria-label')?.includes('发送') ||
                            element.getAttribute('title')?.includes('发送')) {
                            console.log('✅ 找到发送按钮:', {
                                selector: selector,
                                element: element,
                                textContent: element.textContent,
                                className: element.className,
                                id: element.id
                            });
                            return element;
                        }
                    }
                }
            } catch (e) {
                // 忽略选择器错误
                console.log('选择器错误:', selector, e);
            }
        }
        
        // 如果没有找到明确的发送按钮，尝试查找input-content-wrap附近的按钮
        const inputWrap = document.querySelector('.input-content-wrap');
        if (inputWrap) {
            // 查找父容器中的按钮
            const parentContainer = inputWrap.closest('.chat-input-container, .chat-input-wrapper, .chat-input-area');
            if (parentContainer) {
                const buttons = parentContainer.querySelectorAll('button, .send-button');
                for (const button of buttons) {
                    if (button.offsetParent !== null && 
                        button.style.display !== 'none' && 
                        button.style.visibility !== 'hidden') {
                        console.log('✅ 在父容器中找到按钮:', {
                            element: button,
                            textContent: button.textContent,
                            className: button.className
                        });
                        return button;
                    }
                }
            }
            
            // 查找相邻的按钮
            const nextButton = inputWrap.nextElementSibling;
            if (nextButton && (nextButton.tagName === 'BUTTON' || nextButton.classList.contains('send-button'))) {
                console.log('✅ 找到相邻的按钮:', nextButton);
                return nextButton;
            }
        }
        
        // 新增：基于图片中的实际DOM结构，查找chat-input-provider内的发送按钮
        const chatInputProvider = document.querySelector('.chat-input-provider');
        if (chatInputProvider) {
            const sendButton = chatInputProvider.querySelector('.send-button');
            if (sendButton && sendButton.offsetParent !== null && 
                sendButton.style.display !== 'none' && 
                sendButton.style.visibility !== 'hidden') {
                console.log('✅ 在chat-input-provider中找到发送按钮:', {
                    element: sendButton,
                    textContent: sendButton.textContent,
                    className: sendButton.className,
                    id: sendButton.id,
                    dataActive: sendButton.getAttribute('data-active')
                });
                return sendButton;
            }
        }
        
        console.warn('⚠️ 未找到发送按钮');
        return null;
    }

    // 新增：专门向客服发送消息的函数
    async function sendMessageToCustomer(message) {
        try {
            console.log('💬 开始向客服发送消息:', message);
            
            // 等待页面加载完成
            await waitForPageLoad();
            
            // 多种方式查找输入框
            let inputElement = null;
            const inputSelectors = [
                '#input-content',
                '.input-content',
                '.input-content-wrap textarea',
                '.input-content-wrap input',
                '.chat-input-provider textarea',
                '.chat-input-provider input',
                'textarea[placeholder*="输入"]',
                'input[placeholder*="输入"]',
                'textarea[placeholder*="消息"]',
                'input[placeholder*="消息"]',
                '.chat-input textarea',
                '.chat-input input',
                '.message-input',
                '.input-area textarea',
                '.input-area input'
            ];
            
            for (const selector of inputSelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null && 
                    element.style.display !== 'none' && 
                    element.style.visibility !== 'hidden') {
                    inputElement = element;
                    console.log('✅ 找到聊天输入框:', selector);
                    break;
                }
            }
            
            if (!inputElement) {
                // 如果还是没找到，尝试通用查找
                const allTextareas = document.querySelectorAll('textarea');
                const allInputs = document.querySelectorAll('input[type="text"]');
                
                for (const element of [...allTextareas, ...allInputs]) {
                    if (element.offsetParent !== null && 
                        element.style.display !== 'none' && 
                        element.style.visibility !== 'hidden' &&
                        element.offsetWidth > 100 && element.offsetHeight > 20) {
                        inputElement = element;
                        console.log('✅ 通过通用查找找到输入框:', element);
                        break;
                    }
                }
            }
            
            if (!inputElement) {
                throw new Error('未找到聊天输入框');
            }
            
            console.log('✅ 找到聊天输入框:', {
                element: inputElement,
                tagName: inputElement.tagName,
                id: inputElement.id,
                className: inputElement.className,
                type: inputElement.type,
                placeholder: inputElement.placeholder
            });
            
            // 清空输入框内容
            inputElement.value = '';
            
            // 聚焦输入框
            inputElement.focus();
            
            // 等待聚焦完成
            await delay(200);
            
            // 多种方式设置消息内容
            try {
                // 方法1：直接设置value
                inputElement.value = message;
                
                // 方法2：触发input事件
                inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                
                // 方法3：触发change事件
                inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                
                // 方法4：对于textarea，也设置textContent
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.textContent = message;
                }
                
                // 方法5：使用Object.defineProperty（如果直接设置失败）
                try {
                    Object.defineProperty(inputElement, 'value', {
                        writable: true,
                        value: message
                    });
                } catch (defineError) {
                    console.log('Object.defineProperty设置值失败，继续使用其他方法');
                }
                
                console.log('✅ 消息内容已设置:', {
                    value: inputElement.value,
                    textContent: inputElement.textContent
                });
                
            } catch (setValueError) {
                console.warn('⚠️ 设置输入框值失败，尝试备用方法:', setValueError);
                
                // 备用方法：使用execCommand
                try {
                    inputElement.focus();
                    inputElement.select();
                    document.execCommand('insertText', false, message);
                    console.log('✅ 使用execCommand方法设置值成功');
                } catch (execError) {
                    console.warn('⚠️ execCommand方法也失败:', execError);
                    throw new Error('无法设置输入框内容');
                }
            }
            
            // 等待内容设置完成
            await delay(500);
            
            // 查找发送按钮
            let sendButton = null;
            const buttonSelectors = [
                '.send-button',
                '.chat-input-provider .send-button',
                '.input-content-wrap + .send-button',
                '.ct-operate-btn.extra-button',
                '.ct-operate-btn',
                '.extra-button',
                '.send-btn',
                '.chat-send-btn',
                '.message-send-btn',
                '[data-action="send"]',
                '[data-testid="send"]',
                'button[type="submit"]',
                '#send-btn',
                '.chat-send',
                '.message-send'
            ];
            
            for (const selector of buttonSelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null && 
                    element.style.display !== 'none' && 
                    element.style.visibility !== 'hidden') {
                    sendButton = element;
                    console.log('✅ 找到发送按钮:', selector);
                    break;
                }
            }
            
            if (sendButton) {
                console.log('✅ 找到发送按钮:', {
                    element: sendButton,
                    className: sendButton.className,
                    textContent: sendButton.textContent,
                    disabled: sendButton.disabled
                });
                
                // 检查按钮状态
                if (sendButton.disabled) {
                    console.log('⏳ 发送按钮被禁用，等待启用...');
                    await delay(1000);
                    
                    // 再次检查
                    if (sendButton.disabled) {
                        console.warn('⚠️ 发送按钮仍然被禁用，尝试强制点击');
                    }
                }
                
                // 点击发送按钮
                try {
                    sendButton.click();
                    console.log('✅ 已点击发送按钮');
                } catch (clickError) {
                    console.warn('⚠️ 点击发送按钮失败，尝试其他方法:', clickError);
                    
                    // 备用方法1：使用dispatchEvent
                    try {
                        sendButton.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        }));
                        console.log('✅ 已使用dispatchEvent点击发送按钮');
                    } catch (dispatchError) {
                        console.warn('⚠️ dispatchEvent方法也失败:', dispatchError);
                        
                        // 备用方法2：使用mousedown和mouseup事件
                        try {
                            sendButton.dispatchEvent(new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                button: 0
                            }));
                            sendButton.dispatchEvent(new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                button: 0
                            }));
                            console.log('✅ 已使用mousedown/mouseup事件点击发送按钮');
                        } catch (mouseError) {
                            console.warn('⚠️ mousedown/mouseup方法也失败:', mouseError);
                            throw new Error('无法点击发送按钮');
                        }
                    }
                }
                
            } else {
                console.log('⚠️ 未找到发送按钮，尝试使用回车键发送');
                
                // 使用回车键发送
                inputElement.focus();
                
                // 模拟完整的回车键事件序列
                const keyEvents = [
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }),
                    new KeyboardEvent('keypress', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }),
                    new KeyboardEvent('keyup', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    })
                ];
                
                for (const event of keyEvents) {
                    inputElement.dispatchEvent(event);
                    await delay(50);
                }
                
                console.log('✅ 已尝试使用回车键发送消息');
            }
            
            // 等待发送完成
            await delay(1500);
            
            console.log('✅ 消息发送完成:', message);
            return { success: true, message: '消息已成功发送' };
            
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 新增：自动将后端模型返回的数据粘贴到输入框并发送
    async function autoPasteAndSendMessage(aiMessage) {
        try {
            console.log('🤖 开始自动粘贴和发送消息:', aiMessage);
            
            // 检查是否启用自动粘贴发送
            if (!monitoringState.pddChatConfig?.autoPaste) {
                console.log('自动粘贴发送已禁用，跳过自动粘贴发送');
                return;
            }
            
            // 检查是否启用自动发送
            if (!monitoringState.pddChatConfig?.autoSend) {
                console.log('自动发送已禁用，跳过自动发送');
                return { success: false, error: '自动发送已禁用' };
            }
            
            // 查找拼多多聊天页面的输入框 - 基于图片中的实际DOM结构
            const inputSelectors = [
                '#input-content', // 优先查找图片中显示的输入框
                '.input-content', // 备用选择器
                '.input-content-wrap textarea', // 基于图片中的实际结构
                '.input-content-wrap input', // 备用输入框
                'input[type="text"]',
                'textarea',
                '.chat-input',
                '.message-input',
                '#chat-input',
                '[data-testid="chat-input"]',
                '.input-box input',
                '.chat-box input'
            ];
            
            let inputElement = null;
            for (const selector of inputSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // 检查元素是否可见且在聊天区域内
                    if (element.offsetParent !== null && 
                        element.style.display !== 'none' && 
                        element.style.visibility !== 'hidden') {
                        inputElement = element;
                        break;
                    }
                }
                if (inputElement) break;
            }
            
            if (!inputElement) {
                console.warn('⚠️ 未找到聊天输入框，尝试使用API发送');
                return ;
            }
            
            console.log('✅ 找到聊天输入框:', inputElement);
            
            // 清空输入框内容
            inputElement.value = '';
            
            // 模拟用户输入
            inputElement.focus();
            
            // 使用多种方式设置输入框的值 - 针对拼多多聊天页面优化
            try {
                // 方法1：直接设置value（最可靠的方法）
                inputElement.value = aiMessage;
                
                // 方法2：触发input事件（模拟用户输入）
                inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                
                // 方法3：触发change事件（模拟值变化）
                inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                
                // 方法4：使用Object.defineProperty设置值（绕过只读限制）
                try {
                    Object.defineProperty(inputElement, 'value', {
                        writable: true,
                        value: aiMessage
                    });
                } catch (defineError) {
                    console.log('Object.defineProperty设置值失败，继续使用其他方法');
                }
                
                // 方法5：针对textarea的特殊处理
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.textContent = aiMessage;
                    inputElement.innerText = aiMessage;
                }
                
                // 方法6：触发更多事件确保值被正确设置
                inputElement.dispatchEvent(new Event('keydown', { bubbles: true }));
                inputElement.dispatchEvent(new Event('keyup', { bubbles: true }));
                
                console.log('✅ 消息已粘贴到输入框:', {
                    element: inputElement,
                    tagName: inputElement.tagName,
                    id: inputElement.id,
                    className: inputElement.className,
                    value: inputElement.value,
                    textContent: inputElement.textContent
                });
                
            } catch (error) {
                console.warn('⚠️ 设置输入框值失败，尝试备用方法:', error);
                
                // 备用方法1：使用execCommand
                try {
                    inputElement.focus();
                    inputElement.select();
                    document.execCommand('insertText', false, aiMessage);
                    console.log('✅ 使用execCommand方法设置值成功');
                } catch (execError) {
                    console.warn('⚠️ execCommand方法也失败:', execError);
                    
                    // 备用方法2：使用setAttribute
                    try {
                        inputElement.setAttribute('value', aiMessage);
                        console.log('✅ 使用setAttribute方法设置值成功');
                    } catch (attrError) {
                        console.warn('⚠️ setAttribute方法也失败:', attrError);
                    }
                }
            }
            
            // 等待一小段时间确保输入框值已设置
            await delay(500);
            
            // 查找发送按钮 - 使用专用函数
            const sendButton = findPddChatSendButton();
            
            if (!sendButton) {
                console.warn('⚠️ 未找到发送按钮，尝试使用回车键发送');
                
                // 尝试使用回车键发送
                inputElement.focus();
                inputElement.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
                
                inputElement.dispatchEvent(new KeyboardEvent('keypress', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
                
                inputElement.dispatchEvent(new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
                
                console.log('✅ 已尝试使用回车键发送消息');
                
            } else {
                console.log('✅ 找到发送按钮:', sendButton);
                
                // 点击发送按钮 - 针对拼多多聊天页面优化
                try {
                    console.log('🔘 准备点击发送按钮:', {
                        element: sendButton,
                        tagName: sendButton.tagName,
                        id: sendButton.id,
                        className: sendButton.className,
                        textContent: sendButton.textContent,
                        disabled: sendButton.disabled
                    });
                    
                    // 检查按钮是否被禁用
                    if (sendButton.disabled) {
                        console.warn('⚠️ 发送按钮被禁用，等待启用...');
                        // 等待按钮启用
                        await delay(1000);
                        if (sendButton.disabled) {
                            throw new Error('发送按钮仍然被禁用');
                        }
                    }
                    
                    // 方法1：直接点击
                    sendButton.click();
                    console.log('✅ 已点击发送按钮');
                    
                } catch (clickError) {
                    console.warn('⚠️ 点击发送按钮失败，尝试其他方法:', clickError);
                    
                    // 备用方法1：使用dispatchEvent
                    try {
                        sendButton.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        }));
                        console.log('✅ 已使用dispatchEvent点击发送按钮');
                    } catch (dispatchError) {
                        console.warn('⚠️ dispatchEvent方法也失败:', dispatchError);
                        
                        // 备用方法2：使用mousedown和mouseup事件
                        try {
                            sendButton.dispatchEvent(new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                button: 0
                            }));
                            sendButton.dispatchEvent(new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                button: 0
                            }));
                            console.log('✅ 已使用mousedown/mouseup事件点击发送按钮');
                        } catch (mouseError) {
                            console.warn('⚠️ mousedown/mouseup方法也失败:', mouseError);
                        }
                    }
                }
            }
            
            // 等待发送完成
            await delay(1000);
            
            console.log('✅ 自动粘贴和发送完成');
            return { success: true, message: '消息已自动粘贴并发送' };
            
        } catch (error) {
            console.error('❌ 自动粘贴和发送失败:', error);
            
            // 如果自动粘贴发送失败，回退到API发送
            console.log('🔄 回退到API发送方式');
        }
    }

    // 新增：API配置管理函数
    function updateAPIConfig(newConfig) {
        try {
            // 合并配置
            monitoringState.apiConfig = {
                ...monitoringState.apiConfig,
                ...newConfig
            };
            
            console.log('API配置已更新:', monitoringState.apiConfig);
            
            // 保存到存储
            chrome.storage.local.set({
                pddAPIConfig: monitoringState.apiConfig
            });
            
            return { success: true, config: monitoringState.apiConfig };
        } catch (error) {
            console.error('更新API配置失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 获取API配置
    function getAPIConfig() {
        return { ...monitoringState.apiConfig };
    }

    // 重置API配置
    function resetAPIConfig() {
        const defaultConfig = {
            endpoint: 'http://localhost:8090/api/chat/send',
            timeout: 10000,
            maxRetries: 3,
            retryDelay: 1000,
            enabled: true,
            customHeaders: {},
            messageFilter: {
                enabled: true,
                keywords: ['客服', '客服人员', '在线客服'],
                excludeKeywords: ['系统', '通知', '广告'],
                // 新增：身份过滤配置
                roleFilter: {
                    enabled: true,
                    sendServiceMessages: true,
                    sendCustomerMessages: false,
                    sendUnknownRoleMessages: false
                }
            }
        };
        
        monitoringState.apiConfig = defaultConfig;
        
        // 保存到存储
        chrome.storage.local.set({
            pddAPIConfig: defaultConfig
        });
        
        console.log('API配置已重置为默认值');
        return { success: true, config: defaultConfig };
    }



    // 加载保存的API配置
    async function loadAPIConfig() {
        try {
            const result = await chrome.storage.local.get('pddAPIConfig');
            if (result.pddAPIConfig) {
                monitoringState.apiConfig = {
                    ...monitoringState.apiConfig,
                    ...result.pddAPIConfig
                };
                console.log('已加载保存的API配置:', monitoringState.apiConfig);
            }
        } catch (error) {
            console.error('加载API配置失败:', error);
        }
    }

    // 初始化时加载API配置
    loadAPIConfig();

    // 新增：判断是否需要发送到API
    function shouldSendToAPI(messageInfo) {
        // 检查API是否启用
        if (!monitoringState.apiConfig?.enabled) {
            console.log('API发送已禁用，跳过消息:', messageInfo.id);
            return false;
        }

        // 新增：过滤不需要发送给后端的特定消息
        const excludedMessages = monitoringState.apiConfig?.messageFilter?.excludedMessages || [
            "当前版本暂不支持查看此消息，请去App查看。",
            "此消息由机器人发送"
        ];
        
        // 如果配置了排除消息列表，则进行过滤
        if (excludedMessages && excludedMessages.length > 0) {
            // 将字符串转换为数组（如果是逗号分隔的字符串）
            const excludedList = Array.isArray(excludedMessages) ? excludedMessages : excludedMessages.split(',').map(msg => msg.trim());
            
            if (excludedList.some(excludedMsg => messageInfo.content === excludedMsg)) {
                console.log('消息内容被过滤，跳过发送到API:', {
                    id: messageInfo.id,
                    content: messageInfo.content,
                    reason: '内容在排除列表中',
                    excludedList: excludedList
                });
                return false;
            }
        }

        // 只发送客服身份的消息到API
        if (messageInfo.isService) {
            console.log('检测到客服消息，准备发送到API:', {
                id: messageInfo.id,
                role: messageInfo.role,
                isService: messageInfo.isService,
                dataPin: messageInfo.dataPin
            });
            return true;
        } else {
            console.log('消息不是客服身份，跳过发送到API:', {
                id: messageInfo.id,
                role: messageInfo.role,
                isService: messageInfo.isService,
                isCustomer: messageInfo.isCustomer,
                dataPin: messageInfo.dataPin
            });
            return false;
        }
    }

    // 创建控制面板UI
    function createControlPanel() {
        // 检查是否已存在控制面板
        if (document.getElementById('pdd-monitor-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'pdd-monitor-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: white;
            border: 2px solid #ff6b6b;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        panel.innerHTML = `
            <div style="background: #ff6b6b; color: white; padding: 10px; border-radius: 8px 8px 0 0; font-weight: bold; text-align: center;">
                🚀 拼多多聊天监控器
            </div>
            
            <div style="padding: 15px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                        📱 PDD用户ID (pdduid):
                    </label>
                    <input type="text" id="pdduid-input" placeholder="请输入您的pdduid" 
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                    <small style="color: #666; font-size: 12px;">
                        例如: 5463180454658
                    </small>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                        🏪 商城ID (mall_id):
                    </label>
                    <input type="text" id="mall-id-input" placeholder="自动获取或手动输入" 
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">
                        🛍️ 商品ID (goods_id):
                    </label>
                    <input type="text" id="goods-id-input" placeholder="自动获取或手动输入" 
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <label style="font-weight: bold; color: #333;">
                            🍪 Cookie状态:
                        </label>
                        <span id="cookie-status" style="font-size: 12px; color: #666;">
                            🔄 检测中...
                        </span>
                    </div>
                    <div style="background: #f5f5f5; padding: 8px; border-radius: 5px; font-size: 12px; color: #666; word-break: break-all;">
                        <div id="cookie-preview" style="max-height: 60px; overflow: hidden;">
                            等待获取Cookie...
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; margin-bottom: 5px;">
                        <input type="checkbox" id="auto-get-cookie" checked style="margin-right: 8px;">
                        <span style="font-weight: bold; color: #333;">自动获取页面信息</span>
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; margin-bottom: 5px;">
                        <input type="checkbox" id="pdd-chat-enabled" checked style="margin-right: 8px;">
                        <span style="font-weight: bold; color: #333;">启用拼多多聊天接口</span>
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; margin-bottom: 5px;">
                        <input type="checkbox" id="auto-send-enabled" checked style="margin-right: 8px;">
                        <span style="font-weight: bold; color: #333;">自动发送AI回复</span>
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; margin-bottom: 5px;">
                        <input type="checkbox" id="auto-paste-enabled" checked style="margin-right: 8px;">
                        <span style="font-weight: bold; color: #333;">自动粘贴到输入框</span>
                    </label>
                    <small style="color: #666; font-size: 12px; margin-left: 20px;">
                        优先使用自动粘贴发送，失败时回退到API发送
                    </small>
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button id="refresh-page-info" style="flex: 1; padding: 8px; background: #FF9800; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🔄 刷新页面信息
                    </button>
                    <button id="save-pdd-config" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        💾 保存配置
                    </button>
                </div>
                

                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button id="clear-cookie" style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🗑️ 清除Cookie
                    </button>
                </div>
                
                <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px; color: #666;">
                    <strong>功能说明:</strong><br>
                    • 监控客服消息并发送到AI接口<br>
                    • 自动将AI回复发送到拼多多聊天<br>
                    • 支持自定义pdduid配置
                </div>
                
                <!-- 新增：聊天监控状态和控制 -->
                <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 5px; border-left: 4px solid #2196F3;">
                    <div style="font-weight: bold; color: #1976D2; margin-bottom: 10px;">
                        💬 聊天监控状态
                    </div>
                    <div id="chat-monitor-status" style="margin-bottom: 10px; padding: 8px; background: #f5f5f5; border-radius: 3px; font-size: 12px;">
                        🔄 检测中...
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="start-chat-monitor" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            🚀 启动监控
                        </button>
                        <button id="stop-chat-monitor" style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            ⏹️ 停止监控
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 绑定事件
        bindControlPanelEvents();
        
        // 加载保存的配置
        loadPddChatConfig();
        
        // 初始化Cookie状态显示
        updateCookieStatusDisplay();
    }

    // 绑定控制面板事件
    function bindControlPanelEvents() {
        const pdduidInput = document.getElementById('pdduid-input');
        const mallIdInput = document.getElementById('mall-id-input');
        const goodsIdInput = document.getElementById('goods-id-input');
        const autoGetCookieCheckbox = document.getElementById('auto-get-cookie');
        const pddChatEnabled = document.getElementById('pdd-chat-enabled');
        const autoSendEnabled = document.getElementById('auto-send-enabled');
        const autoPasteEnabled = document.getElementById('auto-paste-enabled');
        const refreshPageInfoBtn = document.getElementById('refresh-page-info');
        const saveConfigBtn = document.getElementById('save-pdd-config');

        const clearCookieBtn = document.getElementById('clear-cookie');

        // 新增：聊天监控按钮
        const startChatMonitorBtn = document.getElementById('start-chat-monitor');
        const stopChatMonitorBtn = document.getElementById('stop-chat-monitor');

        // 保存配置
        saveConfigBtn.addEventListener('click', () => {
            const config = {
                pdduid: pdduidInput.value.trim(),
                enabled: pddChatEnabled.checked,
                autoSend: autoSendEnabled.checked,
                autoPaste: autoPasteEnabled.checked,
                cookie: monitoringState.pddChatConfig.cookie,
                mallId: monitoringState.pddChatConfig.mallId,
                goodsId: monitoringState.pddChatConfig.goodsId,
                autoGetCookie: monitoringState.pddChatConfig.autoGetCookie
            };
            
            updatePddChatConfig(config);
            
            // 显示保存成功提示
            saveConfigBtn.textContent = '✅ 已保存';
            saveConfigBtn.style.background = '#4CAF50';
            setTimeout(() => {
                saveConfigBtn.textContent = '💾 保存配置';
                saveConfigBtn.style.background = '#4CAF50';
            }, 2000);
        });

        // 新增：启动聊天监控
        if (startChatMonitorBtn) {
            startChatMonitorBtn.addEventListener('click', () => {
                console.log('🚀 手动启动聊天监控...');
                const result = startChatMonitoring({
                    selector: '#chat-detail-list',
                    checkInterval: 1000,
                    maxHistory: 100,
                    notifyOnNewMessage: true,
                    notifyOnMessageChange: true
                });
                
                if (result.success) {
                    updateChatMonitorStatus('✅ 聊天监控已启动', '#4CAF50');
                    startChatMonitorBtn.disabled = true;
                    stopChatMonitorBtn.disabled = false;
                } else {
                    updateChatMonitorStatus('❌ 启动失败: ' + result.error, '#f44336');
                }
            });
        }

        // 新增：停止聊天监控
        if (stopChatMonitorBtn) {
            stopChatMonitorBtn.addEventListener('click', () => {
                console.log('⏹️ 手动停止聊天监控...');
                stopChatMonitoring();
                updateChatMonitorStatus('⏹️ 聊天监控已停止', '#f44336');
                startChatMonitorBtn.disabled = false;
                stopChatMonitorBtn.disabled = true;
            });
        }

        // 实时更新配置
        pdduidInput.addEventListener('input', () => {
            monitoringState.pddChatConfig.pdduid = pdduidInput.value.trim();
        });

        pddChatEnabled.addEventListener('change', () => {
            monitoringState.pddChatConfig.enabled = pddChatEnabled.checked;
        });

        autoSendEnabled.addEventListener('change', () => {
            monitoringState.pddChatConfig.autoSend = autoSendEnabled.checked;
        });

        autoPasteEnabled.addEventListener('change', () => {
            monitoringState.pddChatConfig.autoPaste = autoPasteEnabled.checked;
        });

        // 刷新页面信息按钮
        refreshPageInfoBtn.addEventListener('click', () => {
            refreshPageInfo();
        });

        // 清除Cookie按钮
        clearCookieBtn.addEventListener('click', () => {
            monitoringState.pddChatConfig.cookie = '';
            monitoringState.pddChatConfig.mallId = '';
            monitoringState.pddChatConfig.goodsId = '';
            
            // 更新UI
            if (mallIdInput) mallIdInput.value = '';
            if (goodsIdInput) goodsIdInput.value = '';
            
            // 更新Cookie状态显示
            updateCookieStatusDisplay();
            
            console.log('Cookie和页面信息已清除');
        });

        // 其他输入框的事件监听
        mallIdInput.addEventListener('input', () => {
            monitoringState.pddChatConfig.mallId = mallIdInput.value.trim();
        });

        goodsIdInput.addEventListener('input', () => {
            monitoringState.pddChatConfig.goodsId = goodsIdInput.value.trim();
        });

        autoGetCookieCheckbox.addEventListener('change', () => {
            monitoringState.pddChatConfig.autoGetCookie = autoGetCookieCheckbox.checked;
        });
    }

    // 更新拼多多聊天配置
    function updatePddChatConfig(newConfig) {
        try {
            monitoringState.pddChatConfig = {
                ...monitoringState.pddChatConfig,
                ...newConfig
            };
            
            console.log('拼多多聊天配置已更新:', monitoringState.pddChatConfig);
            
            // 保存到存储
            chrome.storage.local.set({
                pddChatConfig: monitoringState.pddChatConfig
            });
            
            return { success: true, config: monitoringState.pddChatConfig };
        } catch (error) {
            console.error('更新拼多多聊天配置失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 加载拼多多聊天配置
    async function loadPddChatConfig() {
        try {
            const result = await chrome.storage.local.get('pddChatConfig');
            if (result.pddChatConfig) {
                monitoringState.pddChatConfig = {
                    ...monitoringState.pddChatConfig,
                    ...result.pddChatConfig
                };
                
                // 更新UI显示
                const pdduidInput = document.getElementById('pdduid-input');
                const pddChatEnabled = document.getElementById('pdd-chat-enabled');
                const autoSendEnabled = document.getElementById('auto-send-enabled');
                const autoPasteEnabled = document.getElementById('auto-paste-enabled');
                const mallIdInput = document.getElementById('mall-id-input');
                const goodsIdInput = document.getElementById('goods-id-input');
                const autoGetCookieCheckbox = document.getElementById('auto-get-cookie');
                
                if (pdduidInput) pdduidInput.value = monitoringState.pddChatConfig.pdduid;
                if (pddChatEnabled) pddChatEnabled.checked = monitoringState.pddChatConfig.enabled;
                if (autoSendEnabled) autoSendEnabled.checked = monitoringState.pddChatConfig.autoSend;
                if (autoPasteEnabled) autoPasteEnabled.checked = monitoringState.pddChatConfig.autoPaste;
                if (mallIdInput) mallIdInput.value = monitoringState.pddChatConfig.mallId || '';
                if (goodsIdInput) goodsIdInput.value = monitoringState.pddChatConfig.goodsId || '';
                if (autoGetCookieCheckbox) autoGetCookieCheckbox.checked = monitoringState.pddChatConfig.autoGetCookie;
                
                // 设置AI回复间隔时间
                if (monitoringState.pddChatConfig.aiReplyInterval) {
                    monitoringState.aiReplyInterval = monitoringState.pddChatConfig.aiReplyInterval;
                    console.log('已设置AI回复间隔时间:', monitoringState.aiReplyInterval, '分钟');
                }
                
                // 更新Cookie状态显示
                updateCookieStatusDisplay();
                
                console.log('已加载拼多多聊天配置:', monitoringState.pddChatConfig);
            }
        } catch (error) {
            console.error('加载拼多多聊天配置失败:', error);
        }
    }

    // 自动获取页面cookie和参数
    function autoGetPageInfo() {
        try {
            console.log('🔄 开始自动获取页面信息...');
            
            // 获取当前页面的cookie
            const cookies = document.cookie;
            if (cookies) {
                monitoringState.pddChatConfig.cookie = cookies;
                console.log('✅ 已自动获取页面cookie:', cookies.substring(0, 100) + '...');
            } else {
                console.warn('⚠️ 无法获取页面cookie');
            }
            
            // 从URL中提取mall_id和goods_id
            const urlParams = new URLSearchParams(window.location.search);
            const mallId = urlParams.get('mall_id');
            const goodsId = urlParams.get('goods_id');
            
            if (mallId) {
                monitoringState.pddChatConfig.mallId = mallId;
                console.log('✅ 已获取商城ID:', mallId);
            }
            
            if (goodsId) {
                monitoringState.pddChatConfig.goodsId = goodsId;
                console.log('✅ 已获取商品ID:', goodsId);
            }
            
            // 从URL路径中提取pdduid（如果存在）
            const pdduidMatch = window.location.pathname.match(/pdduid=(\d+)/);
            if (pdduidMatch && !monitoringState.pddChatConfig.pdduid) {
                monitoringState.pddChatConfig.pdduid = pdduidMatch[1];
                console.log('✅ 已从URL获取pdduid:', pdduidMatch[1]);
            }
            
            // 尝试从页面元素中获取pdduid
            if (!monitoringState.pddChatConfig.pdduid) {
                const pdduidElement = document.querySelector('[data-pdduid], [data-user-id], .user-id');
                if (pdduidElement) {
                    const extractedPddUid = pdduidElement.textContent || pdduidElement.dataset.pdduid || pdduidElement.dataset.userId;
                    if (extractedPddUid && /^\d+$/.test(extractedPddUid)) {
                        monitoringState.pddChatConfig.pdduid = extractedPddUid;
                        console.log('✅ 已从页面元素获取pdduid:', extractedPddUid);
                    }
                }
            }
            
            // 尝试从localStorage或sessionStorage中获取pdduid
            if (!monitoringState.pddChatConfig.pdduid) {
                try {
                    const storagePddUid = localStorage.getItem('pdd_user_id') || sessionStorage.getItem('pdd_user_id');
                    if (storagePddUid) {
                        monitoringState.pddChatConfig.pdduid = storagePddUid;
                        console.log('✅ 已从存储中获取pdduid:', storagePddUid);
                    }
                } catch (e) {
                    console.log('无法从存储中获取pdduid:', e);
                }
            }
            
            // 保存自动获取的配置
            updatePddChatConfig(monitoringState.pddChatConfig);
            
            // 更新Cookie状态显示
            updateCookieStatusDisplay();
            
            console.log('📊 页面信息获取完成:', {
                pdduid: monitoringState.pddChatConfig.pdduid,
                mallId: monitoringState.pddChatConfig.mallId,
                goodsId: monitoringState.pddChatConfig.goodsId,
                cookieLength: monitoringState.pddChatConfig.cookie ? monitoringState.pddChatConfig.cookie.length : 0
            });
            
        } catch (error) {
            console.error('❌ 自动获取页面信息失败:', error);
        }
    }
    
    // 手动刷新页面信息
    function refreshPageInfo() {
        console.log('🔄 手动刷新页面信息...');
        autoGetPageInfo();
        
        // 更新UI显示
        const pdduidInput = document.getElementById('pdduid-input');
        const mallIdInput = document.getElementById('mall-id-input');
        const goodsIdInput = document.getElementById('goods-id-input');
        const cookieStatus = document.getElementById('cookie-status');
        
        if (pdduidInput) pdduidInput.value = monitoringState.pddChatConfig.pdduid;
        if (mallIdInput) mallIdInput.value = monitoringState.pddChatConfig.mallId;
        if (goodsIdInput) goodsIdInput.value = monitoringState.pddChatConfig.goodsId;
        
        // 更新Cookie状态显示
        updateCookieStatusDisplay();
    }
    
    // 更新Cookie状态显示
    function updateCookieStatusDisplay() {
        const cookieStatus = document.getElementById('cookie-status');
        if (!cookieStatus) return;
        
        const cookie = monitoringState.pddChatConfig.cookie;
        if (cookie && cookie.length > 0) {
            const cookieCount = cookie.split(';').length;
            const cookiePreview = cookie.substring(0, 50) + (cookie.length > 50 ? '...' : '');
            cookieStatus.innerHTML = `
                <div style="color: #4CAF50; font-weight: bold;">
                    ✅ Cookie已配置 (${cookieCount}个)
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    ${cookiePreview}
                </div>
            `;
        } else {
            cookieStatus.innerHTML = `
                <div style="color: #f44336; font-weight: bold;">
                    ❌ Cookie未配置
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    请点击"🔄 刷新页面信息"自动获取
                </div>
            `;
        }
    }
    
    // 手动设置Cookie
    function setCookieManually() {
        const cookieInput = document.getElementById('cookie-input');
        if (!cookieInput) return;
        
        const cookieValue = cookieInput.value.trim();
        if (cookieValue) {
            monitoringState.pddChatConfig.cookie = cookieValue;
            updatePddChatConfig(monitoringState.pddChatConfig);
            updateCookieStatusDisplay();
            
            // 显示成功提示
            const setCookieBtn = document.getElementById('set-cookie-btn');
            if (setCookieBtn) {
                setCookieBtn.textContent = '✅ 已设置';
                setTimeout(() => {
                    setCookieBtn.textContent = '🔧 手动设置';
                }, 2000);
            }
            
            console.log('✅ 手动设置Cookie成功');
        } else {
            alert('请输入Cookie值');
        }
    }

    // 自动创建控制面板
    setTimeout(() => {
        createControlPanel();
        // 延迟获取页面信息，确保页面完全加载
        setTimeout(() => {
            if (monitoringState.pddChatConfig.autoGetCookie) {
                autoGetPageInfo();
            }
            // 初始化Cookie状态显示
            updateCookieStatusDisplay();
            
            // 新增：自动检测并启动聊天监控
            autoStartChatMonitoring();
        }, 1000);
    }, 2000);

    // 新增：自动启动聊天监控
    function autoStartChatMonitoring() {
        // 检查是否是拼多多聊天页面
        if (isPddChatPage()) {
            console.log('🚀 检测到拼多多聊天页面，自动启动聊天监控...');
            
            // 延迟启动，确保页面完全加载
            setTimeout(() => {
                const result = startChatMonitoring({
                    selector: '#chat-detail-list',
                    checkInterval: 1000,
                    maxHistory: 100,
                    notifyOnNewMessage: true,
                    notifyOnMessageChange: true
                });
                
                if (result.success) {
                    console.log('✅ 聊天监控自动启动成功');
                    
                    // 发送状态更新到popup
                    sendMessageToPopup({
                        action: 'updateChatStatus',
                        isActive: true,
                        status: '聊天监控已自动启动'
                    });
                } else {
                    console.warn('⚠️ 聊天监控自动启动失败:', result.error);
                }
            }, 3000);
        } else {
            console.log('ℹ️ 当前页面不是拼多多聊天页面，跳过自动启动聊天监控');
        }
    }

    // 新增：检测是否是拼多多聊天页面
    function isPddChatPage() {
        const url = window.location.href;
        const title = document.title;
        
        // URL检测
        const isPddUrl = url.includes('pinduoduo.com') || url.includes('yangkeduo.com');
        
        // 标题检测
        const isChatTitle = title.includes('聊天') || title.includes('客服') || title.includes('消息') || 
                           title.includes('Chat') || title.includes('Message') || title.includes('Service');
        
        // 页面内容检测
        const hasChatElements = document.querySelector('.chat-detail-list, .chat-list, .message-list, .chat-messages') ||
                               document.querySelector('.chat-input-provider, .input-content-wrap, .chat-input');
        
        // 页面结构检测
        const hasChatStructure = document.querySelector('[class*="chat"], [class*="message"], [class*="msg"]');
        
        const isChatPage = isPddUrl && (isChatTitle || hasChatElements || hasChatStructure);
        
        console.log('🔍 页面检测结果:', {
            url: url,
            title: title,
            isPddUrl: isPddUrl,
            isChatTitle: isChatTitle,
            hasChatElements: !!hasChatElements,
            hasChatStructure: !!hasChatStructure,
            isChatPage: isChatPage
        });
        
        return isChatPage;
    }

    console.log('拼多多商品聊天监听器已加载');

    // 新增：更新聊天监控状态显示
    function updateChatMonitorStatus(status, color = '#666') {
        const statusElement = document.getElementById('chat-monitor-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.style.color = color;
        }
        
        // 同时更新按钮状态
        const startBtn = document.getElementById('start-chat-monitor');
        const stopBtn = document.getElementById('stop-chat-monitor');
        
        if (startBtn && stopBtn) {
            const isActive = monitoringState.chatMonitoring && monitoringState.chatMonitoring.isActive;
            startBtn.disabled = isActive;
            stopBtn.disabled = !isActive;
        }
    }

    // 新增：定期检查聊天监控状态
    function checkChatMonitorStatus() {
        const status = getChatMonitoringStatus();
        
        if (status.isActive) {
            updateChatMonitorStatus(`✅ 监控运行中 - 消息数量: ${status.messageCount}`, '#4CAF50');
        } else {
            updateChatMonitorStatus('⏹️ 监控已停止', '#f44336');
        }
    }

    // 启动定期状态检查
    setInterval(checkChatMonitorStatus, 2000);

    // 初始化聊天监控状态显示
    setTimeout(() => {
        checkChatMonitorStatus();
    }, 1000);

    // 从页面标题中提取店名
    function extractStoreNameFromTitle(title) {
        if (!title) return '';
        
        // 常见的拼多多标题格式：
        // "【店名】商品名称 - 拼多多"
        // "店名 - 商品名称 - 拼多多"
        // "商品名称 - 店名 - 拼多多"
        
        let storeName = '';
        
        // 尝试匹配【店名】格式
        const bracketMatch = title.match(/【([^】]+)】/);
        if (bracketMatch) {
            storeName = bracketMatch[1];
        } else {
            // 尝试匹配 "店名 - " 格式
            const dashMatch = title.match(/^([^-]+?)\s*-\s*/);
            if (dashMatch) {
                storeName = dashMatch[1].trim();
            } else {
                // 尝试匹配 " - 店名 - " 格式（店名在中间）
                const middleMatch = title.match(/-\s*([^-]+?)\s*-\s*[^-]*拼多多/);
                if (middleMatch) {
                    storeName = middleMatch[1].trim();
                }
            }
        }
        
        // 如果提取的店名太长，可能是商品名称，尝试截取
        if (storeName && storeName.length > 20) {
            storeName = storeName.substring(0, 20) + '...';
        }
        
        // 如果还是没有提取到，使用默认值
        if (!storeName) {
            storeName = '未知店铺';
        }
        
        console.log('从标题提取店名:', { title, storeName });
        return storeName;
    }

    // 发送消息到后端API

    // 新增：监听来自popup的批量发送消息请求
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到来自popup的消息:', message);
        
        if (message.action === 'sendMessageToCustomer') {
            console.log('开始执行批量发送消息:', message.message);
            
            // 执行发送消息
            sendMessageToCustomer(message.message).then(result => {
                console.log('批量发送消息结果:', result);
                sendResponse(result);
            }).catch(error => {
                console.error('批量发送消息失败:', error);
                sendResponse({ success: false, error: error.message });
            });
            
            // 返回true表示异步响应
            return true;
        }
        
        // 其他消息处理...
        return false;
    });

    // 新增：向拼多多聊天发送AI消息的函数
    async function sendAIMessageToPddChat(message) {
        try {
            console.log('🤖 开始向拼多多聊天发送AI消息:', message);
            
            // 检查是否启用拼多多聊天接口
            if (!monitoringState.pddChatConfig?.enabled) {
                console.log('拼多多聊天接口已禁用，跳过发送');
                return { success: false, error: '拼多多聊天接口已禁用' };
            }
            
            // 检查是否启用自动发送
            if (!monitoringState.pddChatConfig?.autoSend) {
                console.log('自动发送已禁用，跳过发送');
                return { success: false, error: '自动发送已禁用' };
            }
            
            // 使用sendMessageToCustomer函数发送消息
            const result = await sendMessageToCustomer(message);
            
            if (result.success) {
                console.log('✅ AI消息发送成功:', message);
                
                // 发送成功通知到popup
                await sendMessageToPopup({
                    action: 'aiMessageSent',
                    success: true,
                    message: message
                });
                
                return result;
            } else {
                console.error('❌ AI消息发送失败:', result.error);
                
                // 发送失败通知到popup
                await sendMessageToPopup({
                    action: 'aiMessageSent',
                    success: false,
                    message: message,
                    error: result.error
                });
                
                return result;
            }
            
        } catch (error) {
            console.error('❌ 发送AI消息异常:', error);
            
            // 发送异常通知到popup
            await sendMessageToPopup({
                action: 'aiMessageSent',
                success: false,
                message: message,
                error: error.message
            });
            
            return { success: false, error: error.message };
        }
    }

    // 新增：暴露sendMessageToCustomer函数给popup使用
    if (typeof window !== 'undefined') {
        window.sendMessageToCustomer = sendMessageToCustomer;
        window.sendAIMessageToPddChat = sendAIMessageToPddChat;
    }

    // 新增：构建对话历史
    function buildConversationHistory() {
        try {
            // 获取聊天历史记录，限制为最近50条
            const chatHistory = getChatHistory(50);
            if (!chatHistory || chatHistory.length === 0) {
                console.log('没有聊天历史记录');
                return '';
            }
            
            // 构建对话格式：客户：*** 客服：***
            let conversationText = '';
            let messageCount = 0;
            
            for (const message of chatHistory) {
                if (messageCount >= 50) break; // 限制最多50条
                
                if (message.content && message.content.trim()) {
                    // 根据身份添加前缀
                    if (message.isService) {
                        conversationText += `客服：${message.content.trim()}\n`;
                    } else if (message.isCustomer) {
                        conversationText += `客户：${message.content.trim()}\n`;
                    } else {
                        // 如果身份未知，尝试从其他属性推断
                        if (message.role === 'service') {
                            conversationText += `客服：${message.content.trim()}\n`;
                        } else if (message.role === 'customer') {
                            conversationText += `客户：${message.content.trim()}\n`;
                        } else {
                            // 如果仍然无法确定，根据data-pin判断
                            if (message.dataPin === '1') {
                                conversationText += `客服：${message.content.trim()}\n`;
                            } else if (message.dataPin === '0') {
                                conversationText += `客户：${message.content.trim()}\n`;
                            } else {
                                // 最后兜底，标记为未知身份
                                conversationText += `未知：${message.content.trim()}\n`;
                            }
                        }
                    }
                    messageCount++;
                }
            }
            
            console.log(`构建对话历史完成，共${messageCount}条消息`);
            return conversationText.trim();
            
        } catch (error) {
            console.error('构建对话历史失败:', error);
            return '';
        }
    }

    // 带超时的消息发送

})(); 