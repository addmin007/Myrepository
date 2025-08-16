package com.consultationtool.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.Random;

// src/main/java/com/consultationtool/service/MessageServiceImpl.java
@Service
public class MessageServiceImpl implements MessageService {
    
    @Autowired
    private MessageRepository messageRepository;
    
    @Override
    public void importMessagesFromFile(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                Message message = new Message();
                message.setContent(line.trim());
                messageRepository.save(message);
            }
        } catch (IOException e) {
            throw new RuntimeException("导入消息失败", e);
        }
    }
    
    @Override
    public List<Message> getAllMessages() {
        return messageRepository.findAll();
    }
    
    @Override
    public Message getRandomMessage() {
        List<Message> messages = getAllMessages();
        if (messages.isEmpty()) {
            return null;
        }
        Random random = new Random();
        return messages.get(random.nextInt(messages.size()));
    }
}