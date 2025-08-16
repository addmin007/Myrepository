package com.consultationtool.model.dto;

import javax.validation.constraints.NotBlank;

public class LoginRequest {
    
    @NotBlank(message = "登录类型不能为空")
    private String loginType; // 手机号, QQ, 微信
    
    @NotBlank(message = "用户名不能为空")
    private String username;
    
    @NotBlank(message = "密码不能为空")
    private String password;
    
    // 构造函数
    public LoginRequest() {}
    
    public LoginRequest(String loginType, String username, String password) {
        this.loginType = loginType;
        this.username = username;
        this.password = password;
    }
    
    // Getter和Setter方法
    public String getLoginType() {
        return loginType;
    }
    
    public void setLoginType(String loginType) {
        this.loginType = loginType;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
}


