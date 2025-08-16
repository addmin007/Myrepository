package com.consultationtool.Service;

import java.util.Map;
import java.util.Random;

// src/main/java/com/consultationtool/service/ConsultationServiceImpl.java
@Service
public class ConsultationServiceImpl implements ConsultationService {
    
    @Autowired
    private AccountService accountService;
    
    @Autowired
    private ProductService productService;
    
    @Autowired
    private MessageService messageService;
    
    @Autowired
    private ProxyService proxyService;
    
    @Override
    public void startBatchConsultation(Map<String, String> params) {
        List<Account> accounts = accountService.getActiveAccounts();
        List<Product> products = productService.getProductsToConsult();
        List<Message> messages = messageService.getMessages();
        
        int delayMin = Integer.parseInt(params.get("delayMin"));
        int delayMax = Integer.parseInt(params.get("delayMax"));
        int changeIpAfter = Integer.parseInt(params.get("changeIpAfter"));
        boolean autoReply = Boolean.parseBoolean(params.get("autoReply"));
        
        Random random = new Random();
        
        for (int i = 0; i < accounts.size(); i++) {
            Account account = accounts.get(i);
            
            // 更换IP逻辑
            if (i % changeIpAfter == 0) {
                proxyService.changeIp();
            }
            
            for (Product product : products) {
                // 随机选择消息
                Message message = messages.get(random.nextInt(messages.size()));
                
                // 发送咨询
                sendConsultation(account, product, message);
                
                // 随机延迟
                int delay = delayMin + random.nextInt(delayMax - delayMin + 1);
                try {
                    Thread.sleep(delay * 1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                
                if (autoReply) {
                    // 检查回复并自动回复
                    checkAndReply(account, product);
                }
            }
        }
    }
    
    private void sendConsultation(Account account, Product product, Message message) {
        // 实现具体的咨询发送逻辑
    }
    
    private void checkAndReply(Account account, Product product) {
        // 检查商家回复并自动回复
    }
}