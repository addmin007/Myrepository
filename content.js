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
        aiReplyInterval: 0, // AI回复间隔时间（秒），0表示立即发送
        isSendingMessage: false, // 防止重复发送消息的标志
        lastSendTime: 0, // 最后发送时间
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
                    '.msg-detail-item',
                    '.chat-item-box',  // 新增：监控图片中显示的消息元素
                    '.chat-rich-text',  // 新增：富文本消息容器
                    '.enrich-text-card-wrap'  // 新增：富文本卡片包装器
                ],
                inputArea: [
                    '.chat-input-provider',
                    '.input-content',
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
            timeout: 200000, // 200秒超时
            maxRetries: 1,  // 最大重试次数
            gaptime: 10000,
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
            aiReplyInterval: 0, // AI回复间隔时间（秒）
            autoPaste: true, // 
            retryDelay: 30000, // 重试延迟（毫秒）
            cookie: '', // 自动获取的cookie
            mallId: '', // 商城ID
            goodsId: '', // 商品ID
            autoGetCookie: true // 是否自动获取cookie
        },
        // 新增：客服消息等待状态管理
        serviceMessageWait: {
            isWaiting: false,        // 是否正在等待
            waitTimer: null,         // 等待计时器
            lastServiceMessage: null, // 最后一条客服消息
            pendingMessages: [],      // 待发送的消息队列
            waitDuration: 10000,  // 等待时间（毫秒），默认10秒
            waitStartTime: null      // 开始等待的时间
        },
        // 新增：客服消息API发送跟踪，避免重复请求并支持200秒无回复重发
        serviceApiTracker: {
            sentMessageIds: new Set(), // 已发送过请求的消息ID
            repliedMessageIds: new Set(), // 已收到回复的消息ID
            resendTimers: new Map(), // messageId -> timerId
            resendIntervalMs: 200000 // 200秒
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
                        '.msg-detail-item',
                        '.chat-item-box',  // 新增：监控图片中显示的消息元素
                        '.chat-rich-text',  // 新增：富文本消息容器
                        '.enrich-text-card-wrap'  // 新增：富文本卡片包装器
                    ],
                    inputArea: [
                        '.chat-input-provider',
                        '.input-content',
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

            // 启动发送状态监控定时器
            startSendingStateMonitor();

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

    // 简化的内容检查 - 只检查基本的文字内容
    function hasValidTextContent(messageElement) {
        try {
            // 简单检查是否有文字内容
            const textContent = messageElement.textContent || messageElement.innerText || '';
            return textContent.trim().length > 0;
        } catch (error) {
            console.error('检查文字内容时出错:', error);
            return false;
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
            
            // 先尝试提取文字内容
            let content = '';
            if (messageElement.textContent) {
                content = cleanContent(messageElement.textContent);
            } else if (messageElement.innerText) {
                content = cleanContent(messageElement.innerText);
            } else if (messageElement.innerHTML) {
                content = cleanContent(messageElement.innerHTML);
            }
            
            // 简单检查是否有有效的文字内容
            const hasValidContent = hasValidTextContent(messageElement);
            
            // 如果有文字内容，进行正常的文字消息处理
            if (content && content.trim().length > 0 && hasValidContent) {
                // 正常的文字消息处理逻辑
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

                // 基于data-pin属性判别身份
                let role = 'unknown';
                let isCustomer = false;
                let isService = false;
                
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
                    // 检查是否是机器人消息
                    const robotElement = messageElement.querySelector('.robot-auto-reply');
                    if (robotElement) {
                        role = 'service';
                        isCustomer = false;
                        isService = true;
                    } else {
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
                }

                return {
                    id: id,
                    content: content,
                    timestamp: timestamp,
                    displayTime: timeElement ? cleanContent(timeElement.textContent) : '',
                    sender: senderElement ? cleanContent(senderElement.textContent) : '',
                    type: typeElement ? typeElement.getAttribute('data-type') || 'text' : 'text',
                    element: messageElement,
                    role: role,
                    isCustomer: isCustomer,
                    isService: isService,
                    dataPin: dataPin
                };
            } else {
                // 即使没有文字内容，也尝试提取其他信息
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

                // 基于data-pin属性判别身份
                let role = 'unknown';
                let isCustomer = false;
                let isService = false;
                
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

                // 尝试提取其他类型的内容（图片、文件等）
                let extractedContent = '';
                let messageType = 'unknown';
                
                // 检查是否有图片
                const imgElement = messageElement.querySelector('img');
                if (imgElement) {
                    extractedContent = imgElement.src || imgElement.getAttribute('data-src') || '图片消息';
                    messageType = 'image';
                }
                // 检查是否有文件
                else if (messageElement.querySelector('[data-type="file"]') || messageElement.querySelector('.file')) {
                    extractedContent = '文件消息';
                    messageType = 'file';
                }
                // 检查是否有链接
                else if (messageElement.querySelector('a')) {
                    const linkElement = messageElement.querySelector('a');
                    extractedContent = linkElement.href || linkElement.textContent || '链接消息';
                    messageType = 'link';
                }
                // 检查是否有表情或特殊内容
                else if (messageElement.querySelector('.emoji') || messageElement.querySelector('[data-type="emoji"]')) {
                    extractedContent = '表情消息';
                    messageType = 'emoji';
                }
                // 如果都没有，使用元素的HTML内容
                else {
                    extractedContent = messageElement.innerHTML || messageElement.outerHTML || '未知消息类型';
                    messageType = 'html';
                }

                return {
                    id: id,
                    content: extractedContent,
                    timestamp: timestamp,
                    displayTime: timeElement ? cleanContent(timeElement.textContent) : '',
                    sender: senderElement ? cleanContent(senderElement.textContent) : '',
                    type: typeElement ? typeElement.getAttribute('data-type') || messageType : messageType,
                    element: messageElement,
                    role: role,
                    isCustomer: isCustomer,
                    isService: isService,
                    dataPin: dataPin
                };
            }
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

        // 新增：当监听到客服发来的消息后，启动7s防抖等待。若7s内无新消息，则请求一次API；若有新消息到达，重置等待计时
        if (messageInfo.isService) {
            try {
                handleServiceMessageForAPI(messageInfo);
            } catch (e) {
                console.error('安排客服消息API发送失败:', e);
            }
        }
        
        // 新增：处理身份未知的消息，直接回复"没太看明白"
        if (!messageInfo.isService && !messageInfo.isCustomer) {
            console.log('检测到身份未知的消息，准备自动回复"没太看明白":', messageInfo);
            handleUnknownRoleMessage(messageInfo);
        }
        
        // 新增：更新消息队列状态到popup
        const queueStatus = messageQueue.getStatus();
        if (queueStatus.queueLength > 0) {
            sendMessageToPopup({
                action: 'updateQueueStatus',
                queueLength: queueStatus.queueLength,
                isProcessing: queueStatus.isProcessing,
                oldestMessage: queueStatus.oldestMessage
            });
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
    // 通知消息变化并发送到后端
    async function notifyMessageChange(messageInfo, changeType) {
        const title = '聊天消息变化';
        const content = `
变化类型: ${changeType}
消息ID: ${messageInfo.id}
内容: ${messageInfo.content}
时间: ${messageInfo.displayTime || messageInfo.timestamp}
身份: ${messageInfo.role}
发送者: ${messageInfo.sender || '未知'}`;

        console.log(title, content);
        
        // 只处理客服消息（data-pin="1"）
        if (messageInfo.isService && messageInfo.dataPin === '1') {
            console.log('🚀 检测到客服消息，准备发送到后端...');
            
            try {
                // 发送到WxPusher
                if (WXPUSHER_TOKEN && WXPUSHER_UID) {
                    const success = await sendWxPusherMessage(
                        WXPUSHER_UID, 
                        '拼多多客服消息', 
                        messageInfo.content, 
                        '客服'
                    );
                    if (success) {
                        console.log('✅ WxPusher消息发送成功');
                    } else {
                        console.log('❌ WxPusher消息发送失败');
                    }
                }
                
                // 发送到飞书
                if (FEISHU_WEBHOOK) {
                    const success = await sendFeishuMessage(
                        FEISHU_WEBHOOK, 
                        '拼多多客服消息', 
                        messageInfo.content, 
                        '客服'
                    );
                    if (success) {
                        console.log('✅ 飞书消息发送成功');
                    } else {
                        console.log('❌ 飞书消息发送失败');
                    }
                }
                
                // 发送到popup
                await sendMessageToPopup({
                    type: 'NEW_MESSAGE',
                    data: {
                        messageInfo: messageInfo,
                        changeType: changeType
                    }
                });
                
            } catch (error) {
                console.error('发送消息到后端失败:', error);
            }
        } else {
            console.log('ℹ️ 非客服消息，跳过发送');
        }
    }

    // 使用定时器定期检查
    function startPeriodicCheck(options) {
        const checkInterval = setInterval(() => {
            // 安全检查：确保monitoringState和chatMonitoring已初始化
            if (!monitoringState || !monitoringState.chatMonitoring || !monitoringState.chatMonitoring.isActive) {
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
            'input-content',
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
                    
                    // 重置发送状态标志，确保后续发送不受影响
                    resetSendingMessageFlag();
                    
                    // 延迟检查，等待消息被添加到列表
                    setTimeout(() => {
                        const currentMessages = getAllChatMessages(options.selector);
                        if (currentMessages.length > (monitoringState.chatMonitoring.lastMessageCount || 0)) {
                            console.log('✅ 检测到新消息通过按钮发送');
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
            'send-button',
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
                
                // 重置发送状态标志，确保后续发送不受影响
                resetSendingMessageFlag();
                
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
                    
                    // 重置发送状态标志，确保后续发送不受影响
                    resetSendingMessageFlag();
                    
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

        // 停止发送状态监控定时器
        stopSendingStateMonitor();

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

    // 工具函数：检测是否处于隐藏模式
    function isInHiddenMode() {
        const hiddenStyle = document.getElementById('pdd-silent-mode-style');
        return hiddenStyle !== null;
    }

    // 工具函数：检查元素是否可见（考虑隐藏模式）
    function isElementVisible(element) {
        // 如果处于隐藏模式，跳过可见性检查，直接返回true
        if (isInHiddenMode()) {
            return true;
        }
        
        // 正常的可见性检查
        return element.offsetParent !== null && 
               element.style.display !== 'none' && 
               element.style.visibility !== 'hidden';
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
            .replace(/^(已读|未读)\s*/, '')    // 删除消息开头的"已读"、"未读"标签
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
                lastCheckTime: Date.now(),
                aiReplyInterval: monitoringState.aiReplyInterval || 0, // 保持现有的AI回复间隔时间，默认为0秒
                isSendingMessage: false, // 防止重复发送消息的标志
                lastSendTime: 0, // 最后发送时间
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
                            '.msg-detail-item',
                            '.chat-item-box',  // 新增：监控图片中显示的消息元素
                            '.chat-rich-text',  // 新增：富文本消息容器
                            '.enrich-text-card-wrap'  // 新增：富文本卡片包装器
                        ],
                        inputArea: [
                            '.chat-input-provider',
                            '.input-content',
                            '.chat-input',
                            '.message-input',
                            '.input-area',
                            '.chat-input-container'
                        ]
                    }
                },
                // 新增：API配置
                apiConfig: {
                    baseUrl: 'http://localhost:8090',
                    goodsId: '', // 商品ID
                    autoGetCookie: true // 是否自动获取cookie
                },
                // 新增：客服消息等待状态管理
                serviceMessageWait: {
                    isWaiting: false,        // 是否正在等待
                    waitTimer: null,         // 等待计时器
                    lastServiceMessage: null, // 最后一条客服消息
                    pendingMessages: [],      // 待发送的消息队列
                    waitDuration: 10000,  // 等待时间（毫秒），默认10秒
                    waitStartTime: null      // 开始等待的时间
                }
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
        console.log('📨 Content script 收到消息:', message, '来自:', sender);

        // 处理ping消息，用于检查content script是否已注入
        if (message.action === 'ping') {
            sendResponse({ status: 'ready' });
            return false;
        }

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

        // 新增：获取监控状态（兼容background.js调用）
        if (message.action === 'getMonitoringStatus') {
            sendResponse({
                isMonitoring: monitoringState.isMonitoring || (monitoringState.chatMonitoring && monitoringState.chatMonitoring.isActive),
                originalContent: monitoringState.originalContent,
                currentContent: monitoringState.currentContent,
                settings: monitoringState.settings,
                chatMonitoring: monitoringState.chatMonitoring ? {
                    isActive: monitoringState.chatMonitoring.isActive,
                    lastMessageCount: monitoringState.chatMonitoring.lastMessageCount,
                    messageHistory: monitoringState.chatMonitoring.messageHistory
                } : null
            });
            return false;
        }

        // 新增：聊天监控相关消息处理
        if (message.action === 'startChatMonitoring') {
            try {
                const result = startChatMonitoring(message.options);
                sendResponse({ success: result.success });
            } catch (error) {
                console.error('启动聊天监控失败:', error);
                sendResponse({ success: false, error: error.message });
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
        
        // 新增：检查页面错误
        if (message.action === 'checkPageError') {
            try {
                const result = checkPageError();
                sendResponse(result);
            } catch (error) {
                sendResponse({ error: error.message });
            }
            return false;
        }
        
        // 新增：测试API连接
        if (message.action === 'testAPIConnection') {
            Promise.resolve()
                .then(async () => {
                    try {
                        const result = await testAPIConnection();
                        sendResponse(result);
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                });
            return true;
        }

        // 新增：处理AI回复间隔时间更新
        if (message.action === 'updateAiReplyInterval') {
            console.log('收到AI回复间隔时间更新:', message.aiReplyInterval);

            const newInterval = Number(message.aiReplyInterval) || 0;

            // 更新内存中的即时值
            monitoringState.aiReplyInterval = newInterval;
            if (monitoringState.pddChatConfig) {
                monitoringState.pddChatConfig.aiReplyInterval = newInterval;
            }

            // 立即持久化，确保刷新后保持一致
            try {
                chrome.storage.local.get('pddChatConfig', function(result) {
                    const cfg = result.pddChatConfig || {};
                    cfg.aiReplyInterval = newInterval;
                    chrome.storage.local.set({ pddChatConfig: cfg }, function() {
                        console.log(`✅ AI回复间隔时间已更新并保存: ${newInterval} 秒`);
                    });
                });
            } catch (e) {
                console.warn('保存AI回复间隔时间到storage失败:', e);
            }

            sendResponse({ success: true, message: `AI回复间隔时间已更新为: ${newInterval} 秒` });
            return true;
        }

        // 添加从设置中更新等待时间的功能
        if (message.action === 'updateSettings') {
            // 更新设置
            monitoringState.settings = message.settings;
            updateWaitDurationFromSettings(message.settings);
            sendResponse({ success: true });
            return true;
        }

        return false;
    });

    // 添加调试函数到全局作用域
    window.debugAIReplyInterval = function() {
        console.log('🔍 === AI回复延迟时间调试信息 ===');
        console.log('📊 monitoringState.aiReplyInterval:', monitoringState.aiReplyInterval);
        console.log('⚙️ pddChatConfig.aiReplyInterval:', monitoringState.pddChatConfig.aiReplyInterval);
        console.log('🧪 getAIReplyInterval() 返回值:', getAIReplyInterval());
        
        // 检查页面输入框
        const intervalInput = document.getElementById('aiReplyIntervalInput');
        if (intervalInput) {
            console.log('📝 页面输入框值:', intervalInput.value);
        } else {
            console.log('⚠️ 页面输入框未找到');
        }
        
        // 检查存储
        chrome.storage.local.get('pddChatConfig', function(result) {
            if (result.pddChatConfig) {
                console.log('💾 存储中的aiReplyInterval:', result.pddChatConfig.aiReplyInterval);
            } else {
                console.log('💾 存储中没有pddChatConfig');
            }
        });
        
        console.log('🔍 === 调试信息结束 ===');
    };

    // 监听存储变化，确保外部保存后也能立即生效
    try {
        if (chrome && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function(changes, areaName) {
                if (areaName !== 'local') return;
                if (changes.pddChatConfig && changes.pddChatConfig.newValue) {
                    const newCfg = changes.pddChatConfig.newValue;
                    if (typeof newCfg.aiReplyInterval !== 'undefined') {
                        const val = Number(newCfg.aiReplyInterval) || 0;
                        monitoringState.aiReplyInterval = val;
                        if (monitoringState.pddChatConfig) {
                            monitoringState.pddChatConfig.aiReplyInterval = val;
                        }
                        console.log(`🔄 监听到storage更新，AI回复间隔时间立即应用: ${val} 秒`);
                    }
                }
            });
        }
    } catch (e) {
        console.warn('注册storage变化监听失败:', e);
    }

    // 页面加载完成后尝试恢复监控
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // 检查是否有保存的监控状态
            const result = await chrome.storage.local.get('pddMonitorState');
            if (result.pddMonitorState && result.pddMonitorState.isMonitoring) {
                console.log('检测到保存的监控状态，尝试恢复...');
                // 这里可以添加恢复监控的逻辑
            }
            
            // 加载拼多多聊天配置（包括AI回复间隔时间）
            await loadPddChatConfig();
            
            // 添加调试信息
            console.log('🎉 Content script已加载，可使用 debugAIReplyInterval() 进行调试');
        } catch (error) {
            console.error('恢复监控状态失败:', error);
        }
    });

    // 立即加载配置（content script可能在页面加载后注入）
    (async () => {
        try {
            await loadPddChatConfig();
        } catch (error) {
            console.error('立即加载配置失败:', error);
        }
    })();

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
        // 清理发送状态监控定时器
        stopSendingStateMonitor();
    });

    

    // 发送回复给客服 - 重写版本
    async function sendReplyToCustomer(replyText) {
        try {
            if (!monitoringState.pddChatConfig?.autoSend) {
                console.log('自动回复已禁用，跳过发送');
                return { success: false, error: '自动回复已禁用' };
            }

            console.log('🚀 开始发送AI回复给客服:', replyText);

            // 获取用户设置的AI回复延迟时间
            const delaySeconds = getAIReplyInterval();
            console.log(`⏱️ AI回复延迟时间: ${delaySeconds} 秒`);

            // 使用延迟发送
            if (delaySeconds > 0) {
                console.log(`⏳ 延迟 ${delaySeconds} 秒后发送AI回复`);
                
                return new Promise((resolve) => {
                    setTimeout(async () => {
                        try {
                            const result = await sendMessageToCustomer(replyText);
                            resolve(result);
                        } catch (error) {
                            resolve({ success: false, error: error.message });
                        }
                    }, delaySeconds * 1000);
                });
            } else {
                // 无延迟直接发送
                const result = await sendMessageToCustomer(replyText);
                return result;
            }

        } catch (error) {
            console.error('❌ 发送回复失败:', error);
            return { success: false, error: error.message };
        }
    }


    // 新增：通用的AI回复发送处理函数
    async function sendAIReplyWithDelay(apiResponse, delaySeconds = 0) {
        try {
            if (delaySeconds > 0) {
                console.log(`⏳ 延迟 ${delaySeconds} 秒后发送AI回复`);
                
                // 延迟发送回复
                setTimeout(async () => {
                    await executeAIReplySend(apiResponse.message);
                }, delaySeconds * 1000);
            } else {
                console.log('🚀 立即发送AI回复给客服');
                await executeAIReplySend(apiResponse.message);
            }
        } catch (error) {
            console.error('❌ 发送AI回复时发生错误:', error);
        }
    }

    // 新增：执行AI回复发送的核心逻辑
    async function executeAIReplySend(message) {
        try {
            console.log('🚀 开始发送AI回复给客服:', message.message || message);
            
            // 直接调用sendReplyToCustomer，它内部会处理延迟
            const sendResult = await sendReplyToCustomer(message.message || message);
            
            if (sendResult && sendResult.success) {
                console.log(`✅ AI回复发送成功，使用方式: ${sendResult.method}`);
            } else {
                console.error('❌ AI回复发送失败:', sendResult?.error || '未知错误');
            }
        } catch (error) {
            console.error('❌ 发送AI回复时发生错误:', error);
        }
    }

    // 新增：通用的错误处理函数
    function handleError(error, context = '操作') {
        console.error(`❌ ${context}失败:`, error.message || error);
        return { success: false, error: error.message || error };
    }

    // 新增：通用的异步错误处理函数
    function handleAsyncError(error, context = '操作') {
        console.error(`❌ ${context}失败:`, error.message || error);
        return { success: false, error: error.message || error };
    }

    // 新增：通用的API响应处理函数
    function handleAPIResponse(response, context = 'API调用') {
        if (response && response.status === 'success') {
            return response;
        } else {
            const errorMessage = response?.error || '未知错误';
            console.error(`❌ ${context}失败:`, errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    // 新增：通用的成功日志函数
    function logSuccess(message, context = '操作') {
        console.log(`✅ ${context}成功: ${message}`);
    }

    // 新增：通用的失败日志函数
    function logError(message, context = '操作') {
        console.error(`❌ ${context}失败: ${message}`);
    }

    // 新增：通用的警告日志函数
    function logWarning(message, context = '操作') {
        console.warn(`⚠️ ${context}警告: ${message}`);
    }

    // 新增：通用的信息日志函数
    function logInfo(message, context = '操作') {
        console.log(`ℹ️ ${context}信息: ${message}`);
    }

    // 新增：通用的DOM元素获取函数
    function getElementById(id, context = '页面') {
        const element = document.getElementById(id);
        if (!element) {
            logWarning(`未找到ID为"${id}"的元素`, context);
        }
        return element;
    }

    // 新增：通用的DOM元素设置值函数
    function setElementValue(elementId, value, context = '页面') {
        const element = getElementById(elementId, context);
        if (element) {
            element.value = value;
            logSuccess(`已设置${elementId}的值为: ${value}`, context);
        }
        return element;
    }

    // 新增：通用的DOM元素设置文本函数
    function setElementText(elementId, text, context = '页面') {
        const element = getElementById(elementId, context);
        if (element) {
            element.textContent = text;
            logSuccess(`已设置${elementId}的文本为: ${text}`, context);
        }
        return element;
    }

    // 新增：处理身份未知的消息，直接回复"没太看明白"
    async function handleUnknownRoleMessage(messageInfo) {
        try {
            console.log('🤔 处理身份未知的消息:', {
                id: messageInfo.id,
                content: messageInfo.content,
                role: messageInfo.role,
                isService: messageInfo.isService,
                isCustomer: messageInfo.isCustomer,
                dataPin: messageInfo.dataPin
            });
            
            // 获取用户设置的AI回复延迟时间
            const delaySeconds = getAIReplyInterval();
            console.log(`⏱️ 身份未知消息回复延迟时间: ${delaySeconds} 秒`);
            
            // 使用统一的延迟发送函数
            await sendAIReplyWithDelay({ message: '没太看明白' }, delaySeconds);
            
            console.log('✅ 身份未知消息自动回复已安排发送');
            
            // 发送通知到popup
            sendMessageToPopup({
                action: 'unknownRoleMessageHandled',
                message: messageInfo,
                reply: '没太看明白',
                success: true
            });
            
        } catch (error) {
            console.error('❌ 处理身份未知消息时发生错误:', error);
            
            // 发送错误通知到popup
            sendMessageToPopup({
                action: 'unknownRoleMessageHandled',
                message: messageInfo,
                reply: '没太看明白',
                success: false,
                error: error.message
            });
        }
    }

    // 新增：处理客服消息，等待7s后发送给后端
    function handleServiceMessageForAPI(messageInfo) {
        // 如果正在等待，取消之前的计时器
        if (monitoringState.serviceMessageWait.isWaiting) {
            clearTimeout(monitoringState.serviceMessageWait.waitTimer);
            console.log('取消之前的等待计时器，重新开始等待');
        }
        
        // 为消息添加时间戳（如果没有的话）
        if (!messageInfo.timestamp) {
            messageInfo.timestamp = Date.now();
        }
        
        // 将消息添加到待发送队列
        monitoringState.serviceMessageWait.pendingMessages.push(messageInfo);
        monitoringState.serviceMessageWait.lastServiceMessage = messageInfo;
        
        // 记录开始等待的时间
        monitoringState.serviceMessageWait.waitStartTime = Date.now();
        
        // 固定使用 15 秒去抖等待
        const waitMs = 15000;
        const waitSeconds = Math.floor(waitMs / 1000);
        // 记录当前等待时间，便于其它地方显示剩余时间
        monitoringState.serviceMessageWait.waitDuration = waitMs;
        
        // 开始等待
        monitoringState.serviceMessageWait.isWaiting = true;
        monitoringState.serviceMessageWait.waitTimer = setTimeout(() => {
            // 等待时间结束后批量发送所有待发送的消息（只请求一次后端）
            sendPendingMessagesToAPI();
        }, waitMs);
        
        // 更新UI状态显示
        updateAPIWaitStatus(`等待中... ${waitSeconds}秒 (${monitoringState.serviceMessageWait.pendingMessages.length}条消息)`, '#ff9800', '⏳');
        
        console.log(`开始等待${waitSeconds}秒，当前待发送消息数: ${monitoringState.serviceMessageWait.pendingMessages.length}`);
    }
    
    // 新增：发送待发送的消息到API
    async function sendPendingMessagesToAPI() {
        if (monitoringState.serviceMessageWait.pendingMessages.length === 0) {
            console.log('没有待发送的消息');
            return;
        }
        
        console.log(`等待时间结束，准备批量发送 ${monitoringState.serviceMessageWait.pendingMessages.length} 条消息到API（单次请求）`);
        
        // 更新UI状态显示
        updateAPIWaitStatus(`发送中... (${monitoringState.serviceMessageWait.pendingMessages.length}条消息)`, '#2196F3', '📤');
        
        // 重置等待状态
        monitoringState.serviceMessageWait.isWaiting = false;
        monitoringState.serviceMessageWait.waitTimer = null;
        monitoringState.serviceMessageWait.waitStartTime = null;
        
        // 构建批量请求负载
        const batchMessages = monitoringState.serviceMessageWait.pendingMessages.map(m => ({
            id: m.id,
            content: m.content,
            timestamp: m.timestamp,
            sender: m.sender || 'unknown',
            role: m.role || 'unknown',
            isService: !!m.isService,
            isCustomer: !!m.isCustomer,
            dataPin: m.dataPin || 'unknown'
        }));
        
        try {
            const apiEndpoint = monitoringState.apiConfig.endpoint;
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'PddChatMonitor/2.1.0',
                'X-Batch-Count': String(batchMessages.length),
                ...monitoringState.apiConfig.customHeaders
            };
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    messageType: 'batch',
                    messages: batchMessages
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const resultText = await response.text();
            let replyMessage = '';
            try {
                const parsed = JSON.parse(resultText);
                replyMessage = typeof parsed?.message === 'string' ? parsed.message : '';
            } catch (e) {
                replyMessage = '';
            }
            if (replyMessage) {
                executeAIReplySend(replyMessage);
            } else {
                console.warn('API响应缺少message字段，已忽略', resultText);
            }
            console.log('批量API响应:', resultText);
        } catch (error) {
            console.error('批量发送消息到API失败:', error);
        }
        
        // 清空待发送队列
        monitoringState.serviceMessageWait.pendingMessages = [];
        monitoringState.serviceMessageWait.lastServiceMessage = null;
        
        // 更新UI状态显示
        updateAPIWaitStatus('空闲中', '#4CAF50', '🟢');
        
        console.log('批量发送完成');
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
                        console.log('🔍 开始解析API响应:', result.response);
                        
                        // 先尝试直接解析JSON
                        let apiResponse;
                        try {
                            apiResponse = JSON.parse(result.response);
                        } catch (jsonError) {
                            console.warn('⚠️ API响应不是有效的JSON格式，尝试其他解析方式');
                            
                            // 如果不是JSON，检查是否是纯文本响应
                            if (typeof result.response === 'string' && result.response.trim()) {
                                console.log('📝 将响应作为纯文本处理');
                                apiResponse = {
                                    status: 'success',
                                    message: result.response.trim()
                                };
                            } else {
                                throw new Error('API响应为空或格式不正确');
                            }
                        }
                        
                        console.log('✅ API响应解析成功:', apiResponse);
                        
                        // 检查响应格式
                        if (apiResponse && (apiResponse.status === 'success' || apiResponse.success)) {
                            const message = apiResponse.message || apiResponse.reply || apiResponse.content;
                            // 标记此消息已收到回复，取消可能的重发定时器
                            try {
                                const tracker = monitoringState.serviceApiTracker;
                                if (tracker) {
                                    tracker.repliedMessageIds.add(messageInfo.id);
                                    const timerId = tracker.resendTimers.get(messageInfo.id);
                                    if (timerId) {
                                        clearTimeout(timerId);
                                        tracker.resendTimers.delete(messageInfo.id);
                                    }
                                }
                            } catch (markErr) {
                                console.warn('标记客服消息已回复失败:', markErr);
                            }
                            
                            if (message) {
                                console.log('✅ 提取到AI回复:', message);
                                // 使用用户设定的延迟时间发送
                                const delaySeconds = getAIReplyInterval();
                                console.log(`⏱️ 使用用户设定延迟发送AI回复: ${delaySeconds} 秒`);
                                await sendAIReplyWithDelay({ message }, delaySeconds);
                                
                                // 通知popup已安排发送
                                await sendMessageToPopup({
                                    action: 'aiMessageSent',
                                    success: true,
                                    message: message,
                                    status: delaySeconds > 0 ? 'scheduled' : 'immediate'
                                });
                                
                            } else {
                                console.warn('⚠️ API响应中没有找到消息内容:', apiResponse);
                                throw new Error('API响应中没有消息内容');
                            }
                        } else {
                            console.warn('⚠️ API响应状态不正确:', apiResponse);
                            const errorMsg = apiResponse?.error || apiResponse?.message || 'API响应状态不正确';
                            throw new Error(errorMsg);
                        }
                    } catch (parseError) {
                        console.error('❌ 解析API响应失败:', parseError.message);
                        console.error('原始响应内容:', result.response);
                        throw new Error(`解析API响应失败: ${parseError.message}`);
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
                
                // 特殊处理503错误
                if (error.message.includes('503') || error.message.includes('服务不可用')) {
                    const shouldContinue = await handle503Error(error, retryCount, maxRetries);
                    if (!shouldContinue) {
                        return { success: false, error: error.message, retryCount: retryCount - 1 };
                    }
                    continue; // 继续重试循环
                }
                
                if (retryCount <= maxRetries) {
                    console.log(`等待${monitoringState.pddChatConfig.retryDelay}ms后重试...`);
                    await delay(monitoringState.pddChatConfig.retryDelay);
                } else {
                    console.error('达到最大重试次数，发送失败');
                    
                    // 如果是"未知错误"，尝试诊断API问题
                    if (error.message.includes('未知错误') || error.message.includes('解析API响应失败')) {
                        console.log('🔧 检测到API解析问题，开始诊断...');
                        try {
                            const diagnostics = await diagnoseAPIProblem();
                            console.log('🔍 API诊断完成:', diagnostics);
                            
                            // 发送诊断结果到popup
                            await sendMessageToPopup({
                                action: 'apiDiagnostics',
                                diagnostics: diagnostics
                            });
                        } catch (diagError) {
                            console.error('API诊断失败:', diagError);
                        }
                    }
                    
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
                // 特殊处理503错误
                if (response.status === 503) {
                    throw new Error(`服务不可用 (503): 服务器暂时无法处理请求，可能是服务器过载或正在维护`);
                }
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
    
    // 处理503错误的专用函数
    async function handle503Error(error, retryCount, maxRetries) {
        console.error(`🚨 503服务不可用错误 (第${retryCount}次):`, error.message);
        
        // 503错误建议更长的等待时间
        const waitTime = Math.min(5000 + (retryCount * 2000), 30000); // 5秒到30秒递增
        
        if (retryCount <= maxRetries) {
            console.log(`⏳ 503错误，等待${waitTime}ms后重试...`);
            await delay(waitTime);
            return true; // 继续重试
        } else {
            console.error('❌ 503错误达到最大重试次数，建议检查服务器状态');
            
            // 发送503错误通知到popup
            await sendMessageToPopup({
                action: 'apiMessageSent',
                success: false,
                message: '服务器暂时不可用',
                error: `503服务不可用: ${error.message}`,
                retryCount: retryCount - 1,
                errorType: '503'
            });
            
            return false; // 停止重试
        }
    }
    
    // 新增：API连接测试函数
    async function testAPIConnection() {
        try {
            console.log('🔍 开始测试API连接...');
            
            if (!monitoringState.apiConfig?.endpoint) {
                throw new Error('API端点未配置');
            }
            
            const testMessage = {
                id: 'test_' + Date.now(),
                content: 'API连接测试消息',
                timestamp: Date.now(),
                sender: 'test',
                role: 'customer',
                isService: false,
                isCustomer: true
            };
            
            console.log('📤 发送测试消息到API:', monitoringState.apiConfig.endpoint);
            
            const result = await sendMessageWithTimeout(testMessage, 0);
            
            if (result.success) {
                console.log('✅ API连接测试成功');
                console.log('API响应:', result.response);
                
                // 尝试解析响应
                try {
                    const response = JSON.parse(result.response);
                    console.log('✅ API响应解析成功:', response);
                    
                    if (response.status === 'success' || response.success) {
                        console.log('✅ API功能正常');
                        return { success: true, message: 'API连接和功能测试通过' };
                    } else {
                        console.warn('⚠️ API功能异常:', response);
                        return { success: false, error: `API功能异常: ${response.error || response.message || '未知错误'}` };
                    }
                } catch (parseError) {
                    console.warn('⚠️ API响应解析失败，但连接正常');
                    return { success: true, message: 'API连接正常，但响应格式需要检查' };
                }
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ API连接测试失败:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    // 新增：诊断API问题
    async function diagnoseAPIProblem() {
        console.log('🔧 开始诊断API问题...');
        
        const diagnostics = {
            config: {
                endpoint: monitoringState.apiConfig?.endpoint || '未配置',
                timeout: monitoringState.apiConfig?.timeout || '未配置',
                maxRetries: monitoringState.apiConfig?.maxRetries || '未配置',
                enabled: monitoringState.apiConfig?.enabled || false
            },
            connection: null,
            lastError: null
        };
        
        console.log('📋 API配置信息:', diagnostics.config);
        
        // 测试连接
        diagnostics.connection = await testAPIConnection();
        
        // 记录诊断结果
        console.log('🔍 API诊断结果:', diagnostics);
        
        return diagnostics;
    }

    // 新增：查找拼多多聊天页面的发送按钮
    async function findPddChatSendButton() {
        // 基于图片中显示的实际DOM结构，查找发送按钮
        const sendButtonSelectors = [
            '.send-button', // 优先使用图片中显示的发送按钮
            'button', // 优先使用图片中显示的发送按钮
        ];
        
        // 首先检查输入框是否有内容，如果没有内容，发送按钮不会出现
        const inputElement = document.querySelector('input-content');
        if (inputElement) {
            const hasContent = inputElement.value || inputElement.textContent || inputElement.innerText;
            if (!hasContent) {
                console.log('⚠️ 输入框没有内容，发送按钮不会出现，等待内容设置...');
                await delay(1000);
            }
        }
        
        // 持续查找直到找到 send-button 元素
        let maxAttempts = 8; // 增加最大尝试次数
        let attempt = 0;
        
        while (attempt < maxAttempts) {
            attempt++;
            console.log(`🔍 第 ${attempt} 次尝试查找发送按钮...`);
            
            for (const selector of sendButtonSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        // 检查按钮是否可见（考虑隐藏模式）
                        if (isElementVisible(element)) {
                            
                            // 对于 send-button 类的按钮，直接认为是发送按钮
                            if (element.classList.contains('send-button')) {
                                console.log('✅ 找到拼多多聊天发送按钮:', {
                                    selector: selector,
                                    element: element,
                                    textContent: element.textContent,
                                    className: element.className,
                                    id: element.id,
                                    dataActive: element.getAttribute('data-active'),
                                    attempts: attempt
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
            
            // 如果没有找到，等待一段时间后重试
            if (attempt < maxAttempts) {
                console.log(`⏳ 第 ${attempt} 次未找到发送按钮，等待 800ms 后重试...`);
                
                // 在重试之前，再次检查输入框是否有内容
                const inputElement = document.querySelector('input-content');
                if (inputElement) {
                    const hasContent = inputElement.value || inputElement.textContent || inputElement.innerText;
                    if (!hasContent) {
                        console.log('⚠️ 重试前检查：输入框仍然没有内容，等待更长时间...');
                        await new Promise(resolve => setTimeout(resolve, 12000)); // 等待更长时间
                    } else {
                        console.log('✅ 重试前检查：输入框有内容，继续查找发送按钮...');
                        await new Promise(resolve => setTimeout(resolve, 10000)); // 正常等待时间
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // 正常等待时间
                }
            }
        }
        
        // 如果没有找到明确的发送按钮，尝试查找input-content-wrap附近的按钮
        const inputWrap = document.querySelector('input-content');
        if (inputWrap) {
            // 查找父容器中的按钮
            const parentContainer = inputWrap.closest('.chat-input-container, .chat-input-wrapper, .chat-input-area');
            if (parentContainer) {
                const buttons = parentContainer.querySelectorAll('button, .send-button');
                for (const button of buttons) {
                    if (isElementVisible(button)) {
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
            if (sendButton && isElementVisible(sendButton)) {
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

    // 整合后的发送消息函数 - 支持多种发送方式
    async function sendMessageToCustomer(message) {
        try {
            console.log('💬 开始向客服发送消息:', message);
            
            // 防重复发送机制
            if (monitoringState.isSendingMessage) {
                console.log('⚠️ 消息正在发送中，跳过重复发送');
                return { success: false, error: '消息正在发送中' };
            }
            
            // 设置发送状态标志
            monitoringState.isSendingMessage = true;
            monitoringState.lastSendTime = Date.now();
            
            // 添加超时保护，防止状态标志永远无法重置
            const timeoutId = setTimeout(() => {
                if (monitoringState.isSendingMessage) {
                    console.warn('⚠️ 发送超时，强制重置发送状态标志');
                    monitoringState.isSendingMessage = false;
                }
            }, 45000); // 45秒超时保护
            
            try {
                // 第一步：等待页面稳定
                await delay(500);
                
                // 第二步：查找并准备输入框
                const inputElement = await findAndPrepareInputElement();
                if (!inputElement) {
                    throw new Error('无法找到或准备聊天输入框');
                }
                
                // 第三步：设置输入框内容
                const setContentSuccess = await setInputContent(inputElement, message);
                if (!setContentSuccess) {
                    throw new Error('设置输入框内容失败');
                }
                
                // 第四步：验证输入框内容
                const contentValid = await validateInputContent(inputElement, message);
                if (!contentValid) {
                    throw new Error('输入框内容验证失败');
                }
                
                // 第五步：等待发送按钮出现
                await delay(1000);
                
                // 第六步：查找发送按钮
                const sendButton = await findPddChatSendButton();
                
                // 第七步：发送消息
                if (sendButton) {
                    await clickSendButton(sendButton);
                } else {
                    await sendWithEnterKey(inputElement);
                }
                
                // 第八步：等待发送完成
                await delay(1500);
                
                console.log('✅ 消息发送完成:', message);
                return { success: true, message: '消息已成功发送' };
                
            } catch (error) {
                console.error('❌ 发送消息失败:', error);
                
                // 如果主要发送方法失败，尝试备用方法
                console.log('🔄 尝试备用发送方法...');
                try {
                    const fallbackResult = await fallbackSendMessage(message);
                    if (fallbackResult.success) {
                        return fallbackResult;
                    }
                } catch (fallbackError) {
                    console.error('❌ 备用发送方法也失败:', fallbackError);
                }
                
                return { success: false, error: error.message };
            } finally {
                // 重置发送状态标志
                monitoringState.isSendingMessage = false;
                clearTimeout(timeoutId); // 清除超时保护
            }
            
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            return { success: false, error: error.message };
        } finally {
            // 确保状态标志被重置
            monitoringState.isSendingMessage = false;
        }
    }

    
    // 新增：查找并准备输入框
    async function findAndPrepareInputElement() {
        console.log('🔍 查找并准备聊天输入框...');
        
                const inputSelectors = [
                    '#input-content', // 备用选择器
                    '.input-content', // 备用选择器
                ];
                
                let inputElement = null;
        
        // 尝试所有选择器
                for (const selector of inputSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (isElementVisible(element)) {
                            inputElement = element;
                    console.log('✅ 找到聊天输入框:', selector);
                            break;
                        }
                    }
                    if (inputElement) break;
                }
                
        
        if (!inputElement) {
            console.error('❌ 未找到聊天输入框');
            return null;
        }
        
        console.log('✅ 找到聊天输入框:', {
            element: inputElement,
            tagName: inputElement.tagName,
            id: inputElement.id,
            className: inputElement.className,
            type: inputElement.type,
            placeholder: inputElement.placeholder
        });
        
        return inputElement;
    }
    
    // 设置输入框内容（不清空原有内容）
    async function setInputContent(inputElement, message) {
        console.log('📝 设置输入框内容...', { message: message.substring(0, 50) + '...' });
        
        if (!inputElement || !message) {
            console.error('❌ 输入框元素或消息为空');
            return false;
        }
        
        // 确保输入框可见和可编辑
        if (!isElementVisible(inputElement) || inputElement.disabled || inputElement.readOnly) {
            console.warn('⚠️ 输入框不可见或不可编辑，尝试滚动到可见位置');
            inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(500);
        }
        
        // 聚焦输入框并等待稳定
        inputElement.focus();
        await delay(300);
        
        // 清空现有内容（如果需要）
        const currentValue = inputElement.value || inputElement.textContent || inputElement.innerText || '';
        if (currentValue.trim()) {
            console.log('🧹 清空现有内容:', currentValue.substring(0, 30) + '...');
            inputElement.value = '';
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.textContent = '';
                inputElement.innerText = '';
            }
            inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            console.log('执行了触发事件');
            await delay(200);
        }
        
        // 使用多种方式设置消息内容，确保成功
        const setValueMethods = [
            // 方法1：直接设置value（最常用）
            () => {
                inputElement.value = message;
                inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                console.log('方法一来执行了触发事件');
            },
            // 方法2：针对textarea的特殊处理
            () => {
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.textContent = message;
                    inputElement.innerText = message;
                    inputElement.value = message;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    console.log('方法二执行了触发事件');
                }
            },
            // 方法3：使用Object.defineProperty（处理只读属性）
            () => {
                console.log('方法三执行了触发事件');
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(inputElement, 'value');
                    if (descriptor && !descriptor.writable) {
                        Object.defineProperty(inputElement, 'value', {
                            writable: true,
                            value: message
                        });
                    } else {
                        inputElement.value = message;
                    }
                    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                } catch (e) {
                    console.log('Object.defineProperty设置值失败:', e.message);
                }
            },
            // 方法4：使用setAttribute
            () => {
                console.log('方法四执行了触发事件');
                try {
                    inputElement.setAttribute('value', message);
                    inputElement.value = message;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                } catch (e) {
                    console.log('setAttribute设置值失败:', e.message);
                }
            },
            // 方法5：使用execCommand（模拟用户输入）
            () => {
                console.log('方法五执行了触发事件');
                try {
                    inputElement.focus();
                    inputElement.select();
                    document.execCommand('insertText', false, message);
                } catch (e) {
                    console.log('execCommand设置值失败:', e.message);
                }
            },
            // 方法6：使用Clipboard API（现代浏览器）
            async () => {
                console.log('方法六执行了触发事件');
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(message);
                        inputElement.focus();
                        inputElement.select();
                        document.execCommand('paste');
                    }
                } catch (e) {
                    console.log('Clipboard API设置值失败:', e.message);
                }
            },
            // 方法7：模拟键盘输入
            () => {
                console.log('方法七执行了触发事件');
                try {
                    inputElement.focus();
                    inputElement.select();
                    
                    // 模拟键盘事件
                    const keyEvents = ['keydown', 'keypress', 'keyup'];
                    keyEvents.forEach(eventType => {
                        inputElement.dispatchEvent(new KeyboardEvent(eventType, {
                            key: 'a',
                            code: 'KeyA',
                            bubbles: true,
                            cancelable: true
                        }));
                    });
                    
                    // 使用insertText命令
                    document.execCommand('insertText', false, message);
                } catch (e) {
                    console.log('模拟键盘输入失败:', e.message);
                }
            },
            // 方法8：强制设置所有可能的属性
            () => {
                console.log('方法八执行了触发事件');
                try {
                    inputElement.value = message;
                    inputElement.textContent = message;
                    inputElement.innerText = message;
                    inputElement.setAttribute('value', message);
                    inputElement.setAttribute('data-value', message);
                    
                    // 触发所有相关事件
                    const events = ['input', 'change', 'keydown', 'keyup', 'paste', 'focus', 'blur'];
                    events.forEach(eventType => {
                        inputElement.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                    });
                } catch (e) {
                    console.log('强制设置所有属性失败:', e.message);
                }
            }
        ];
        
        let success = false;
        let lastError = null;
        
        // 依次尝试所有方法，最多重试3次
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
            console.log(`🔄 第${attempt + 1}次尝试设置输入框内容...`);
            
            for (let i = 0; i < setValueMethods.length; i++) {
                try {
                    const method = setValueMethods[i];
                    if (method.constructor.name === 'AsyncFunction') {
                        await method();
                    } else {
                        method();
                    }
                    
                    await delay(150);
                    
                    // 检查是否设置成功
                    const currentValue = inputElement.value || inputElement.textContent || inputElement.innerText || '';
                    if (currentValue === message || currentValue.includes(message.substring(0, 10))) {
                        console.log(`✅ 使用方法${i + 1}设置值成功`);
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.log(`⚠️ 方法${i + 1}失败:`, error.message);
                    lastError = error;
                }
            }
            
            if (!success && attempt < 2) {
                console.log('⏳ 等待后重试...');
                await delay(500);
            }
        }
        
        // 如果所有方法都失败，尝试最后的强制设置
        if (!success) {
            console.warn('⚠️ 所有方法都失败，尝试最后的强制设置...');
            try {
                inputElement.focus();
                inputElement.value = message;
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.textContent = message;
                    inputElement.innerText = message;
                }
                
                // 触发所有可能的事件
                const allEvents = ['input', 'change', 'keydown', 'keyup', 'paste', 'focus', 'blur', 'compositionstart', 'compositionend'];
                allEvents.forEach(eventType => {
                    inputElement.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                });
                
                await delay(300);
                
                const finalValue = inputElement.value || inputElement.textContent || inputElement.innerText || '';
                if (finalValue === message) {
                    console.log('✅ 强制设置成功');
                    success = true;
                }
            } catch (error) {
                console.error('❌ 强制设置也失败:', error);
                lastError = error;
            }
        }
        
        // 最终验证
        const finalValue = inputElement.value || inputElement.textContent || inputElement.innerText || '';
        const isSuccess = finalValue === message || finalValue.includes(message.substring(0, 10));
        
        console.log('📊 输入框内容设置结果:', {
            success: isSuccess,
            expected: message.substring(0, 50) + '...',
            actual: finalValue.substring(0, 50) + '...',
            value: inputElement.value,
            textContent: inputElement.textContent,
            innerText: inputElement.innerText,
            lastError: lastError?.message
        });
        
        return isSuccess;
    }
    
    // 新增：验证输入框内容
    async function validateInputContent(inputElement, expectedMessage) {
        console.log('🔍 验证输入框内容...', { expected: expectedMessage.substring(0, 50) + '...' });
        
        if (!inputElement || !expectedMessage) {
            console.error('❌ 输入框元素或期望消息为空');
            return false;
        }
        
        // 等待内容设置完成
        await delay(300);
        
        // 多次验证，确保内容稳定
        const maxAttempts = 3;
        let isValid = false;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`🔍 第${attempt + 1}次验证输入框内容...`);
            
            // 获取当前内容
            const currentValue = inputElement.value || '';
            const currentTextContent = inputElement.textContent || '';
            const currentInnerText = inputElement.innerText || '';
            
            // 检查各种可能的内容属性
            const allValues = [currentValue, currentTextContent, currentInnerText];
            
            // 严格匹配检查
            const exactMatch = allValues.some(value => value === expectedMessage);
            
            // 部分匹配检查（至少包含前10个字符）
            const partialMatch = allValues.some(value => 
                value.includes(expectedMessage.substring(0, Math.min(10, expectedMessage.length)))
            );
            
            // 长度检查（防止内容被截断）
            const lengthMatch = allValues.some(value => 
                Math.abs(value.length - expectedMessage.length) <= 5
            );
            
            console.log('📊 验证结果:', {
                attempt: attempt + 1,
                exactMatch,
                partialMatch,
                lengthMatch,
                expectedLength: expectedMessage.length,
                actualLengths: allValues.map(v => v.length),
                values: allValues.map(v => v.substring(0, 30) + '...')
            });
            
            if (exactMatch) {
                console.log('✅ 精确匹配验证成功');
                isValid = true;
                break;
            } else if (partialMatch && lengthMatch) {
                console.log('✅ 部分匹配验证成功');
                isValid = true;
                break;
            }
            
            if (attempt < maxAttempts - 1) {
                console.log('⏳ 等待后重新验证...');
                await delay(500);
            }
        }
        
        // 如果验证失败，尝试最后的修复
        if (!isValid) {
            console.warn('⚠️ 验证失败，尝试最后的修复...');
            
            try {
                // 强制重新设置内容
                inputElement.focus();
                inputElement.value = expectedMessage;
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.textContent = expectedMessage;
                    inputElement.innerText = expectedMessage;
                }
                
                // 触发所有相关事件
                const events = ['input', 'change', 'keydown', 'keyup', 'paste'];
                events.forEach(eventType => {
                    inputElement.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                });
                
                await delay(300);
                
                // 最终验证
                const finalValue = inputElement.value || inputElement.textContent || inputElement.innerText || '';
                isValid = finalValue === expectedMessage || finalValue.includes(expectedMessage.substring(0, 10));
                
                if (isValid) {
                    console.log('✅ 最后修复成功');
                } else {
                    console.error('❌ 最后修复也失败');
                }
            } catch (error) {
                console.error('❌ 最后修复过程中出错:', error);
            }
        }
        
        console.log('📊 最终验证结果:', {
            success: isValid,
            expected: expectedMessage.substring(0, 50) + '...',
            actual: (inputElement.value || inputElement.textContent || inputElement.innerText || '').substring(0, 50) + '...',
            element: {
                tagName: inputElement.tagName,
                id: inputElement.id,
                className: inputElement.className
            }
        });
        
        return isValid;
    }
    
    // 新增：点击发送按钮
    async function clickSendButton(sendButton) {
        console.log('🔘 准备点击发送按钮...');
        
        // 检查按钮状态
                        if (sendButton.disabled) {
            console.log('⏳ 发送按钮被禁用，等待启用...');
                            await delay(1000);
            
                            if (sendButton.disabled) {
                                throw new Error('发送按钮仍然被禁用');
                            }
                        }
                        
                        // 确保按钮可点击状态
                        if (sendButton.style.pointerEvents === 'none') {
            console.log('⏳ 发送按钮pointer-events为none，等待恢复...');
                            await delay(500);
                        }
                        
                        // 防止重复点击
                        sendButton.disabled = true;
                        
        try {
            // 方法1：直接点击
            sendButton.click();
            console.log('✅ 已点击发送按钮');
                    } catch (clickError) {
            console.warn('⚠️ 直接点击失败，尝试其他方法:', clickError);
                        
            // 方法2：使用dispatchEvent
                        try {
                            sendButton.dispatchEvent(new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            }));
                console.log('✅ 已使用dispatchEvent点击发送按钮');
                        } catch (dispatchError) {
                            console.warn('⚠️ dispatchEvent方法也失败:', dispatchError);
                            
                // 方法3：使用mousedown和mouseup事件
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
            }
        }
                                
        // 2秒后恢复按钮状态
                                setTimeout(() => {
                                    sendButton.disabled = false;
                                }, 2000);
    }
    
    // 新增：使用回车键发送
    async function sendWithEnterKey(inputElement) {
        console.log('⚠️ 未找到发送按钮，使用回车键发送');
        
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
        
        console.log('✅ 已使用回车键发送消息');
    }
    
    // 新增：备用发送方法
    async function fallbackSendMessage(message) {
        console.log('🔄 使用备用发送方法...');
        
        try {
            // 尝试使用API发送
            const result = await sendMessageToCustomer(message);
            if (result.success) {
                console.log('✅ 备用发送方法成功');
                return result;
            }
        } catch (error) {
            console.error('❌ 备用发送方法失败:', error);
        }
        
        // 如果API发送也失败，尝试其他方法
        console.log('🔄 尝试其他备用方法...');
        
        // 这里可以添加更多的备用发送逻辑
        // 比如模拟用户操作、使用其他API等
        
        return { success: false, error: '所有备用方法都失败' };
    }

    // 新增：强制重置发送状态标志的函数
    function resetSendingState() {
        if (monitoringState.isSendingMessage) {
            console.log('🔄 强制重置发送状态标志');
            monitoringState.isSendingMessage = false;
            monitoringState.lastSendTime = 0;
        }
    }
    
    // 新增：消息发送队列管理
    const messageQueue = {
        queue: [],
        isProcessing: false,
        maxRetries: 3,
        retryDelay: 2000,
        
        // 添加消息到队列
        add(message) {
            this.queue.push({
                id: Date.now() + Math.random(),
                message: message,
                timestamp: Date.now(),
                retryCount: 0
            });
            console.log(`📝 消息已添加到队列，当前队列长度: ${this.queue.length}`);
            
            // 如果队列没有在处理，开始处理
            if (!this.isProcessing) {
                this.process();
            }
        },
        
        // 处理队列中的消息
        async process() {
            if (this.isProcessing || this.queue.length === 0) {
                return;
            }
            
            this.isProcessing = true;
            console.log(`🔄 开始处理消息队列，当前队列长度: ${this.queue.length}`);
            
            while (this.queue.length > 0) {
                const queueItem = this.queue[0];
                console.log(`📤 处理队列消息 ${queueItem.id}:`, queueItem.message);
                
                try {
                    // 尝试发送消息
                    const result = await this.sendMessageWithRetry(queueItem);
                    
                    if (result.success) {
                        console.log(`✅ 队列消息 ${queueItem.id} 发送成功`);
                        // 从队列中移除成功发送的消息
                        this.queue.shift();
                    } else {
                        console.error(`❌ 队列消息 ${queueItem.id} 发送失败:`, result.error);
                        
                        // 增加重试次数
                        queueItem.retryCount++;
                        
                        if (queueItem.retryCount >= this.maxRetries) {
                            console.error(`❌ 队列消息 ${queueItem.id} 达到最大重试次数，从队列中移除`);
                            this.queue.shift();
                        } else {
                            console.log(`⏳ 队列消息 ${queueItem.id} 等待重试，当前重试次数: ${queueItem.retryCount}`);
                            // 将消息移到队列末尾，等待重试
                            this.queue.push(this.queue.shift());
                            // 等待一段时间后继续处理
                            await delay(this.retryDelay);
                        }
                    }
                } catch (error) {
                    console.error(`❌ 处理队列消息 ${queueItem.id} 时发生错误:`, error);
                    // 从队列中移除出错的消息
                    this.queue.shift();
                }
                
                // 处理完一条消息后稍作等待
                await delay(1000);
            }
            
            this.isProcessing = false;
            console.log('✅ 消息队列处理完成');
        },
        
        // 带重试的消息发送
        async sendMessageWithRetry(queueItem) {
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    console.log(`🔄 尝试发送队列消息 (第${retryCount + 1}次):`, queueItem.message);
                    
                    // 优先使用自动粘贴发送
                    const result = await sendMessageToCustomer(queueItem.message);
                    if (result.success) {
                        return result;
                    }
                    
                    // 如果自动粘贴失败，等待后重试
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`⏳ 等待${this.retryDelay}ms后重试...`);
                        await delay(this.retryDelay);
                    }
                    
                } catch (error) {
                    console.error(`❌ 发送队列消息失败 (第${retryCount + 1}次):`, error);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await delay(this.retryDelay);
                    }
                }
            }
            
            return { success: false, error: '达到最大重试次数' };
        },
        
        // 获取队列状态
        getStatus() {
            return {
                queueLength: this.queue.length,
                isProcessing: this.isProcessing,
                oldestMessage: this.queue.length > 0 ? this.queue[0] : null
            };
        },
        
        // 清空队列
        clear() {
            this.queue.length = 0;
            this.isProcessing = false;
            console.log('🗑️ 消息队列已清空');
        }
    };
    
    // 新增：定期检查并重置异常状态的定时器
    function startStateHealthCheck() {
        // 每60秒检查一次状态
        setInterval(() => {
            const now = Date.now();
            const timeSinceLastSend = now - monitoringState.lastSendTime;
            
            // 如果发送状态异常（超过5分钟没有重置）
            if (monitoringState.isSendingMessage && timeSinceLastSend > 300000) {
                console.warn('⚠️ 检测到异常发送状态，强制重置');
                resetSendingState();
            }
            
            // 检查消息队列状态
            const queueStatus = messageQueue.getStatus();
            if (queueStatus.queueLength > 0) {
                console.log(`📊 消息队列状态: ${queueStatus.queueLength}条消息待发送，处理中: ${queueStatus.isProcessing}`);
                
                // 如果队列中有消息但处理停止，尝试重新启动
                if (!queueStatus.isProcessing && queueStatus.queueLength > 0) {
                    console.log('🔄 检测到队列处理停止，重新启动处理');
                    messageQueue.process();
                }
            }
        }, 60000); // 60秒检查一次
        
        console.log('✅ 状态健康检查已启动');
    }
    
    // 新增：获取消息队列状态的函数（供外部调用）
    function getMessageQueueStatus() {
        return messageQueue.getStatus();
    }
    
    // 新增：清空消息队列的函数（供外部调用）
    function clearMessageQueue() {
        messageQueue.clear();
        return { success: true, message: '消息队列已清空' };
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
            gaptime: 10000,
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

    // 新增：重置发送状态标志
    function resetSendingMessageFlag() {
        if (monitoringState.isSendingMessage) {
            console.log('🔄 重置发送状态标志');
            monitoringState.isSendingMessage = false;
        }
    }

    // 新增：强制重置所有状态
    function forceResetAllStates() {
        console.log('🔄 强制重置所有状态');
        monitoringState.isSendingMessage = false;
        monitoringState.chatMonitoring.isActive = false;
        monitoringState.chatMonitoring.lastMessageCount = 0;
        monitoringState.chatMonitoring.lastMessageIds.clear();
        monitoringState.chatMonitoring.messageHistory = [];
        
        // 清理定时器
        if (monitoringState.refreshInterval) {
            clearInterval(monitoringInterval);
            monitoringState.refreshInterval = null;
        }
        if (monitoringState.countdownTimer) {
            clearTimeout(monitoringState.countdownTimer);
            monitoringState.countdownTimer = null;
        }
        
        // 停止发送状态监控定时器
        stopSendingStateMonitor();
        
        console.log('✅ 所有状态已重置');
    }

    // 新增：启动发送状态监控定时器
    function startSendingStateMonitor() {
        // 每30秒检查一次发送状态，如果卡死则自动重置
        const stateMonitorInterval = setInterval(() => {
            if (monitoringState.isSendingMessage) {
                const currentTime = Date.now();
                const lastSendTime = monitoringState.lastSendTime || 0;
                
                // 如果发送状态持续超过60秒，强制重置
                if (currentTime - lastSendTime > 60000) {
                    console.warn('⚠️ 发送状态卡死超过60秒，强制重置');
                    resetSendingMessageFlag();
                }
            }
        }, 30000);
        
        // 保存定时器引用
        monitoringState.stateMonitorInterval = stateMonitorInterval;
        
        console.log('✅ 发送状态监控定时器已启动');
    }

    // 新增：停止发送状态监控定时器
    function stopSendingStateMonitor() {
        if (monitoringState.stateMonitorInterval) {
            clearInterval(monitoringState.stateMonitorInterval);
            monitoringState.stateMonitorInterval = null;
            console.log('✅ 发送状态监控定时器已停止');
        }
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
                dataPin: messageInfo.dataPin,
                type: messageInfo.type,
                content: messageInfo.content
            });
            return true;
        } else if (messageInfo.role === 'unknown' && !messageInfo.isService && !messageInfo.isCustomer) {
            // 身份未知的消息不发送到API，由handleUnknownRoleMessage处理
            console.log('检测到身份未知的消息，不发送到API，将由handleUnknownRoleMessage处理:', {
                id: messageInfo.id,
                role: messageInfo.role,
                isService: messageInfo.isService,
                isCustomer: messageInfo.isCustomer,
                dataPin: messageInfo.dataPin,
                type: messageInfo.type,
                content: messageInfo.content
            });
            return false;
        } else {
            console.log('消息不是客服身份，跳过发送到API:', {
                id: messageInfo.id,
                role: messageInfo.role,
                isService: messageInfo.isService,
                isCustomer: messageInfo.isCustomer,
                dataPin: messageInfo.dataPin,
                type: messageInfo.type
            });
            return false;
        }
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
        console.log(document.getElementById('savePddConfigBtn'));
        const saveConfigBtn = document.getElementById('savePddConfigBtn');

        const clearCookieBtn = document.getElementById('clear-cookie');

        // 新增：聊天监控按钮
        const startChatMonitorBtn = document.getElementById('start-chat-monitor');
        const stopChatMonitorBtn = document.getElementById('stop-chat-monitor');
        
        // 新增：AI回复时间间隔输入框
        const aiReplyIntervalInput = document.getElementById('aiReplyIntervalInput');
        console.log(aiReplyIntervalInput);

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
                autoGetCookie: monitoringState.pddChatConfig.autoGetCookie,
                aiReplyInterval: aiReplyIntervalInput ? parseFloat(aiReplyIntervalInput.value) || 0 : 0
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
        
        // AI回复时间间隔输入框事件监听
        if (aiReplyIntervalInput) {
            aiReplyIntervalInput.addEventListener('input', () => {
                const newValue = parseFloat(aiReplyIntervalInput.value);
                if (!isNaN(newValue) && newValue >= 1 && newValue <= 3600) {
                    monitoringState.aiReplyInterval = newValue;
                    monitoringState.pddChatConfig.aiReplyInterval = newValue;
                    console.log(`🔄 实时更新AI回复时间间隔: ${newValue} 秒`);
                }
            });
            
            aiReplyIntervalInput.addEventListener('blur', () => {
                const newValue = parseFloat(aiReplyIntervalInput.value);
                if (!isNaN(newValue) && newValue >= 1 && newValue <= 3600) {
                    monitoringState.aiReplyInterval = newValue;
                    monitoringState.pddChatConfig.aiReplyInterval = newValue;
                    console.log(`💾 保存AI回复时间间隔: ${newValue} 秒`);
                    
                    // 保存到存储
                    chrome.storage.local.set({
                        pddChatConfig: monitoringState.pddChatConfig
                    });
                }
            });
        }

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
                if (monitoringState.pddChatConfig.aiReplyInterval !== undefined && monitoringState.pddChatConfig.aiReplyInterval !== null) {
                    monitoringState.aiReplyInterval = monitoringState.pddChatConfig.aiReplyInterval;
                    console.log('✅ 已从存储中加载AI回复间隔时间:', monitoringState.aiReplyInterval, '秒');
                    
                    // 更新UI输入框的值
                    const aiReplyIntervalInput = document.getElementById('aiReplyIntervalInput');
                    if (aiReplyIntervalInput) {
                        aiReplyIntervalInput.value = monitoringState.aiReplyInterval;
                        console.log('✅ 已更新AI回复时间间隔输入框的值:', monitoringState.aiReplyInterval);
                        
                        // 设置输入框的事件监听器（避免重复设置）
                        if (!aiReplyIntervalInput.hasAttribute('data-listener-set')) {
                            setupIntervalInputListener();
                        }
                    }
                } else {
                    console.log('ℹ️ 存储中没有AI回复间隔时间配置，使用默认值0秒');
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
        // createControlPanel(); // 暂时注释掉，因为函数未定义
        
        // 优先启动消息检测，确保客服界面加载后立即开始监控
        autoStartChatMonitoring();
        
        // 延迟获取页面信息，确保页面完全加载
        setTimeout(() => {
            if (monitoringState.pddChatConfig.autoGetCookie) {
                autoGetPageInfo();
            }
            // 初始化Cookie状态显示
            updateCookieStatusDisplay();
            
            // 新增：设置AI回复时间间隔输入框监听器
            // 现在在控制面板创建完成后自动设置，无需手动调用
            
            // 新增：启动状态健康检查
            startStateHealthCheck();
        }, 1000);
    }, 2000);

    // 新增：自动启动聊天监控
    function autoStartChatMonitoring() {
        // 检查是否是拼多多聊天页面
        if (isPddChatPage()) {
            console.log('🚀 检测到拼多多聊天页面，立即启动聊天监控...');
            
            // 减少延迟时间，让消息检测更快启动
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
            }, 500); // 从3000ms减少到500ms
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
                               document.querySelector('.chat-input-provider, input-content');
        
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
    
    // 新增：更新API等待状态显示
    function updateAPIWaitStatus(message, color = '#333', icon = '🟢') {
        const statusElement = document.getElementById('api-wait-status');
        if (statusElement) {
            statusElement.innerHTML = `${icon} ${message}`;
            statusElement.style.color = color;
        }
    }

    // 新增：为客服消息安排API发送与200秒无回复重发
    function scheduleServiceMessageApiSend(messageInfo) {
        try {
            const tracker = monitoringState.serviceApiTracker;
            if (!tracker) return;

            // 去重：如果此消息已发送过或已收到回复，则不再发送
            if (tracker.sentMessageIds.has(messageInfo.id) || tracker.repliedMessageIds.has(messageInfo.id)) {
                console.log('跳过重复的客服消息API发送:', messageInfo.id);
                return;
            }

            // 标记为已发送
            tracker.sentMessageIds.add(messageInfo.id);
            console.log('立即发送客服消息到API:', messageInfo.id);

            // 立即发送
            sendCustomerMessageToAPI(messageInfo).catch(err => {
                console.error('首次发送客服消息到API失败:', err);
            });

            // 设置200秒无回复则重发一次
            const timerId = setTimeout(() => {
                try {
                    // 如果在200秒内已收到回复，则不重发
                    if (tracker.repliedMessageIds.has(messageInfo.id)) {
                        console.log('已收到回复，取消重发:', messageInfo.id);
                        tracker.resendTimers.delete(messageInfo.id);
                        return;
                    }

                    console.log('200秒内未收到回复，执行重发:', messageInfo.id);
                    sendCustomerMessageToAPI(messageInfo).finally(() => {
                        tracker.resendTimers.delete(messageInfo.id);
                    });
                } catch (reErr) {
                    console.error('执行重发时出错:', reErr);
                    tracker.resendTimers.delete(messageInfo.id);
                }
            }, tracker.resendIntervalMs);

            tracker.resendTimers.set(messageInfo.id, timerId);
        } catch (error) {
            console.error('安排客服消息API发送失败:', error);
        }
    }

    // 新增：为"已去抖动发送"的消息安排200秒无回复仅重发一次
    function scheduleNoReplyResend(messageInfo) {
        try {
            const tracker = monitoringState.serviceApiTracker;
            if (!tracker) return;

            // 若已记录为收到回复，则不安排
            if (tracker.repliedMessageIds.has(messageInfo.id)) {
                return;
            }

            // 若已存在定时器，先清除，确保只保留一次200秒检查
            const existing = tracker.resendTimers.get(messageInfo.id);
            if (existing) {
                clearTimeout(existing);
                tracker.resendTimers.delete(messageInfo.id);
            }

            const timerId = setTimeout(() => {
                try {
                    if (tracker.repliedMessageIds.has(messageInfo.id)) {
                        tracker.resendTimers.delete(messageInfo.id);
                        return;
                    }
                    console.log('200秒内未收到回复，执行一次重发:', messageInfo.id);
                    sendCustomerMessageToAPI(messageInfo).finally(() => {
                        tracker.resendTimers.delete(messageInfo.id);
                    });
                } catch (err) {
                    console.error('200秒无回复重发执行出错:', err);
                    tracker.resendTimers.delete(messageInfo.id);
                }
            }, tracker.resendIntervalMs);

            tracker.resendTimers.set(messageInfo.id, timerId);
        } catch (error) {
            console.error('安排200秒无回复重发失败:', error);
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
    
    // 新增：定期检查API等待状态
    function checkAPIWaitStatus() {
        // 安全检查：确保monitoringState和serviceMessageWait已初始化
        if (!monitoringState || !monitoringState.serviceMessageWait) {
            return;
        }
        
        const waitState = monitoringState.serviceMessageWait;
        
        if (waitState.isWaiting && waitState.waitStartTime) {
            // 计算剩余等待时间
            const elapsed = Date.now() - waitState.waitStartTime;
            const remaining = Math.max(0, waitState.waitDuration - elapsed);
            const remainingSeconds = Math.ceil(remaining / 1000);
            
            if (remainingSeconds > 0) {
                updateAPIWaitStatus(`等待中... ${remainingSeconds}s (${waitState.pendingMessages.length}条消息)`, '#ff9800', '⏳');
            }
        }
    }

    // 启动定期状态检查
    setInterval(checkChatMonitorStatus, 2000);
    
    // 新增：定期检查API等待状态
    setInterval(checkAPIWaitStatus, 1000);

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
            
            // 获取用户设置的AI回复延迟时间
            const delaySeconds = getAIReplyInterval();
            console.log(`⏱️ 批量发送消息延迟时间: ${delaySeconds} 秒`);
            
            // 使用统一的延迟发送函数
            sendAIReplyWithDelay({ message: message.message }, delaySeconds).then(() => {
                console.log('批量发送消息已安排发送');
                sendResponse({ success: true, message: '消息已安排发送' });
            }).catch(error => {
                console.error('批量发送消息失败:', error);
                sendResponse({ success: false, error: error.message });
            });
            
            // 返回true表示异步响应
            return true;
        }
        
        // 新增：处理文件监控发送的问候语消息
        if (message.action === 'sendMessage') {
            console.log('收到文件监控发送问候语请求:', message.message);
            
            // 获取用户设置的AI回复延迟时间
            const delaySeconds = getAIReplyInterval();
            console.log(`⏱️ 问候语发送延迟时间: ${delaySeconds} 秒`);
            
            // 使用统一的延迟发送函数
            sendAIReplyWithDelay({ message: message.message }, delaySeconds).then(() => {
                console.log('问候语发送已安排发送');
                sendResponse({ success: true, message: '问候语已安排发送' });
            }).catch(error => {
                console.error('问候语发送失败:', error);
                sendResponse({ success: false, error: error.message });
            });
            
            // 返回true表示异步响应
            return true;
        }
        
        // 其他消息处理...
        return false;
    });



    // 新增：暴露sendMessageToCustomer函数给popup使用
    if (typeof window !== 'undefined') {
        window.sendMessageToCustomer = sendMessageToCustomer;
        window.sendAIMessageToPddChat = sendAIMessageToPddChat;
    }

    // 新增：获取用户设定的AI回复时间间隔
    function getAIReplyInterval() {
        try {
            console.log('🔍 getAIReplyInterval() 被调用');
            console.log('📊 monitoringState.aiReplyInterval:', monitoringState.aiReplyInterval);
            console.log('⚙️ monitoringState.pddChatConfig.aiReplyInterval:', monitoringState.pddChatConfig.aiReplyInterval);
            
            // 优先从全局状态获取用户设定的时间间隔
            if (monitoringState.aiReplyInterval !== undefined && monitoringState.aiReplyInterval !== null) {
                console.log(`✅ 从全局状态获取到用户设定的时间间隔: ${monitoringState.aiReplyInterval} 秒`);
                return monitoringState.aiReplyInterval;
            }
            
            // 尝试从页面上的输入框获取用户设定的时间间隔（备用方案）
            const intervalInput = document.getElementById('aiReplyIntervalInput');
            if (intervalInput && intervalInput.value) {
                const userInput = parseFloat(intervalInput.value);
                console.log(`📝 页面输入框原始值: "${intervalInput.value}", 解析后: ${userInput}`);
                if (!isNaN(userInput) && userInput >= 0 && userInput <= 3600) {
                    // 更新全局状态
                    monitoringState.aiReplyInterval = userInput;
                    console.log(`✅ 从页面输入框获取到用户设定的时间间隔: ${userInput} 秒`);
                    return userInput;
                } else {
                    console.warn('⚠️ 页面输入框的值无效，使用默认值0秒');
                }
            } else {
                console.log('⚠️ 页面输入框未找到或值为空');
            }
            
            // 如果都找不到，使用默认值0秒（立即发送）
            const fallbackInterval = 0;
            console.log(`ℹ️ 使用默认时间间隔: ${fallbackInterval} 秒（立即发送）`);
            return fallbackInterval;
            
        } catch (error) {
            console.error('获取AI回复时间间隔失败:', error);
            return 0; // 默认值改为0秒（立即发送）
        }
    }

    // 新增：监听页面输入框变化，实时更新全局状态
    // 添加全局标志防止重复调用
    let intervalListenerSetupAttempts = 0;
    const MAX_SETUP_ATTEMPTS = 3;
    
    function setupIntervalInputListener() {
        try {
            // 防止重复调用
            if (intervalListenerSetupAttempts >= MAX_SETUP_ATTEMPTS) {
                console.log('ℹ️ AI回复时间间隔输入框监听器设置次数已达上限，停止尝试');
                return;
            }
            
            const intervalInput = document.getElementById('aiReplyIntervalInput');
            if (intervalInput) {
                // 检查是否已经设置过监听器
                if (intervalInput.hasAttribute('data-listener-set')) {
                    console.log('ℹ️ AI回复时间间隔输入框监听器已存在，跳过重复设置');
                    return;
                }
                
                // 监听输入框值变化
                intervalInput.addEventListener('input', (event) => {
                    const newValue = parseFloat(event.target.value);
                    if (!isNaN(newValue) && newValue >= 0 && newValue <= 3600) {
                        monitoringState.aiReplyInterval = newValue;
                        console.log(`🔄 实时更新AI回复时间间隔: ${newValue} 秒`);
                        
                        // 同时更新拼多多聊天配置
                        if (monitoringState.pddChatConfig) {
                            monitoringState.pddChatConfig.aiReplyInterval = newValue;
                        }
                        
                        // 保存到存储
                        chrome.storage.local.set({
                            pddChatConfig: monitoringState.pddChatConfig
                        });
                    }
                });
                
                // 监听失去焦点事件
                intervalInput.addEventListener('blur', (event) => {
                    const newValue = parseFloat(event.target.value);
                    if (!isNaN(newValue) && newValue >= 0 && newValue <= 3600) {
                        monitoringState.aiReplyInterval = newValue;
                        console.log(`💾 保存AI回复时间间隔: ${newValue} 秒`);
                        
                        // 同时更新拼多多聊天配置
                        if (monitoringState.pddChatConfig) {
                            monitoringState.pddChatConfig.aiReplyInterval = newValue;
                        }
                        
                        // 保存到存储
                        chrome.storage.local.set({
                            pddChatConfig: monitoringState.pddChatConfig
                        });
                    }
                });
                
                // 标记已设置监听器
                intervalInput.setAttribute('data-listener-set', 'true');
                console.log('✅ AI回复时间间隔输入框监听器已设置');
            } else {
                // 增加尝试次数
                intervalListenerSetupAttempts++;
                if (intervalListenerSetupAttempts < MAX_SETUP_ATTEMPTS) {
                    // 静默处理，不输出日志，避免控制台刷屏
                    // console.log('ℹ️ 未找到AI回复时间间隔输入框，可能控制面板还未创建');
                } else {
                    console.log('ℹ️ AI回复时间间隔输入框设置失败，已达到最大尝试次数');
                }
            }
        } catch (error) {
            console.error('设置AI回复时间间隔输入框监听器失败:', error);
        }
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
                                conversationText += `客户：${message.content.trim()}\n`;
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

    // 新增：检查页面错误
    function checkPageError() {
        try {
            // 检查页面标题是否包含错误信息
            const pageTitle = document.title.toLowerCase();
            const errorKeywords = [
                'error', '错误', '404', 'not found', '找不到', '页面不存在',
                '店铺下线', '商品下架', '链接失效', '网络错误', '服务器错误',
                '访问受限', '权限不足', '页面超时', '加载失败'
            ];
            
            // 检查页面内容是否包含错误信息
            const pageContent = document.body.textContent.toLowerCase();
            const errorElements = document.querySelectorAll('.error, .error-message, .error-msg, .error-info, .error-text');
            
            // 检查URL是否包含错误信息
            const currentUrl = window.location.href.toLowerCase();
            
            // 检查是否有明显的错误页面特征
            let hasError = false;
            let errorReason = '';
            
            // 1. 检查页面标题
            for (const keyword of errorKeywords) {
                if (pageTitle.includes(keyword)) {
                    hasError = true;
                    errorReason = `页面标题包含错误信息: ${keyword}`;
                    break;
                }
            }
            
            // 2. 检查页面内容
            if (!hasError) {
                for (const keyword of errorKeywords) {
                    if (pageContent.includes(keyword)) {
                        hasError = true;
                        errorReason = `页面内容包含错误信息: ${keyword}`;
                        break;
                    }
                }
            }
            
            // 3. 检查错误元素
            if (!hasError && errorElements.length > 0) {
                hasError = true;
                errorReason = `页面包含错误元素: ${errorElements.length}个`;
            }
            
            // 4. 检查页面结构是否正常
            if (!hasError) {
                // 检查是否有主要内容区域
                const mainContent = document.querySelector('main, .main, .content, .container, .page-content');
                if (!mainContent || mainContent.textContent.trim().length < 100) {
                    // 页面内容太少，可能有问题
                    hasError = true;
                    errorReason = '页面内容异常，可能加载失败';
                }
            }
            
            // 5. 检查拼多多特定错误
            if (!hasError) {
                // 检查拼多多特定的错误页面
                const pddErrorSelectors = [
                    '.error-page',
                    '.error-container',
                    '.not-found',
                    '.page-not-found',
                    '.shop-closed',
                    '.goods-offline',
                    '.link-invalid'
                ];
                
                for (const selector of pddErrorSelectors) {
                    if (document.querySelector(selector)) {
                        hasError = true;
                        errorReason = `拼多多错误页面: ${selector}`;
                        break;
                    }
                }
            }
            
            console.log('页面错误检查结果:', { hasError, errorReason });
            
            return {
                hasError: hasError,
                errorReason: errorReason,
                pageTitle: document.title,
                url: window.location.href,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('检查页面错误失败:', error);
            return {
                hasError: false,
                errorReason: `检查失败: ${error.message}`,
                pageTitle: document.title || '未知',
                url: window.location.href,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 添加从设置中更新等待时间的功能
    function updateWaitDurationFromSettings(settings) {
        if (settings && settings.messageWaitDuration) {
            const newDuration = settings.messageWaitDuration * 1000; // 转换为毫秒
            monitoringState.serviceMessageWait.waitDuration = newDuration;
            // 同步到 API 配置的 gaptime，确保发送间隔一致
            monitoringState.apiConfig.gaptime = newDuration;
            console.log(`等待时间已更新为: ${settings.messageWaitDuration}秒 (${newDuration}毫秒)，已同步到apiConfig.gaptime`);
        }
    }

    // 在消息监听器中添加设置更新处理
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script收到消息:', message);
        
        switch (message.action) {
            // ... existing cases ...
            
            case 'updateSettings':
                // 更新设置
                monitoringState.settings = message.settings;
                updateWaitDurationFromSettings(message.settings);
                // 确保从设置到 API 配置的 gaptime 同步
                if (message.settings && typeof message.settings.messageWaitDuration === 'number') {
                    monitoringState.apiConfig.gaptime = message.settings.messageWaitDuration * 1000;
                }
                sendResponse({ success: true });
                break;
                
            // ... existing cases ...
        }
    });

})();