package com.consultationtool.Service;

import java.io.BufferedReader;
import java.io.IOException;

// src/main/java/com/consultationtool/service/ProductServiceImpl.java
@Service
public class ProductServiceImpl implements ProductService {
    
    @Autowired
    private ProductRepository productRepository;
    
    @Override
    public void importProductsFromFile(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                Product product = new Product();
                product.setUrl(line.trim());
                product.setActive(false); // 默认未验证
                productRepository.save(product);
            }
        } catch (IOException e) {
            throw new RuntimeException("导入产品失败", e);
        }
    }
    
    @Override
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }
    
    @Override
    public List<Product> getProductsToConsult() {
        return productRepository.findByActiveTrue();
    }
    
    @Override
    public void verifyProducts() {
        List<Product> products = productRepository.findAll();
        for (Product product : products) {
            boolean isActive = checkProductStatus(product.getUrl());
            product.setActive(isActive);
            productRepository.save(product);
        }
    }
    
    private boolean checkProductStatus(String url) {
        // 实现检查产品是否上架的逻辑
        return true;
    }
}