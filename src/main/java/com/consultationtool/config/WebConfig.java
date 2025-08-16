package com.consultationtool.config;

// src/main/java/com/consultationtool/config/WebConfig.java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("redirect:/login");
        registry.addViewController("/login").setViewName("login");
        registry.addViewController("/main").setViewName("main");
    }
    
    @Bean
    public MultipartResolver multipartResolver() {
        CommonsMultipartResolver resolver = new CommonsMultipartResolver();
        resolver.setMaxUploadSize(10485760); // 10MB
        return resolver;
    }
}