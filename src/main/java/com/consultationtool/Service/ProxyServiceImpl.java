package com.consultationtool.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
public class ProxyServiceImpl implements ProxyService {
    
    @Autowired
    private ProxyRepository proxyRepository;
    
    private String currentIp;
    
    @Override
    public void changeIp() {
        List<Proxy> proxies = proxyRepository.findAll();
        if (!proxies.isEmpty()) {
            Random random = new Random();
            Proxy proxy = proxies.get(random.nextInt(proxies.size()));
            currentIp = proxy.getIpAddress();
            // 实际更换IP的逻辑
            System.out.println("更换IP为: " + currentIp);
        }
    }
    
    @Override
    public String getCurrentIp() {
        return currentIp;
    }
}