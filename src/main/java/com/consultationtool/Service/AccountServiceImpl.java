package com.consultationtool.Service;

import java.io.BufferedReader;
import java.io.IOException;

// src/main/java/com/consultationtool/service/AccountServiceImpl.java
@Service
public class AccountServiceImpl implements AccountService {
    
    @Autowired
    private AccountRepository accountRepository;
    
    @Override
    public void importAccountsFromFile(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split(",");
                if (parts.length >= 2) {
                    Account account = new Account();
                    account.setUsername(parts[0]);
                    account.setPassword(parts[1]);
                    account.setType(parts.length > 2 ? parts[2] : "手机号");
                    account.setOnline(false);
                    accountRepository.save(account);
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("导入账号失败", e);
        }
    }
    
    @Override
    public List<Account> getAllAccounts() {
        return accountRepository.findAll();
    }
    
    @Override
    public List<Account> getActiveAccounts() {
        return accountRepository.findByOnlineTrue();
    }
    
    @Override
    public boolean checkAccountStatus(Account account) {
        // 实现检查账号是否在线的逻辑
        return false;
    }
}