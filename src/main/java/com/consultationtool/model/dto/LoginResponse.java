package com.consultationtool.model.dto;

public class LoginResponse {
    
    private boolean success;
    private String message;
    private String token;
    private String userType;
    private String nickname;
    private String username;
    
    // 构造函数
    public LoginResponse() {}
    
    public LoginResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    
    public LoginResponse(boolean success, String message, String token, String userType, String nickname, String username) {
        this.success = success;
        this.message = message;
        this.token = token;
        this.userType = userType;
        this.nickname = nickname;
        this.username = username;
    }
    
    // 静态工厂方法
    public static LoginResponse success(String token, String userType, String nickname, String username) {
        return new LoginResponse(true, "登录成功", token, userType, nickname, username);
    }
    
    public static LoginResponse failure(String message) {
        return new LoginResponse(false, message);
    }
    
    // Getter和Setter方法
    public boolean isSuccess() {
        return success;
    }
    
    public void setSuccess(boolean success) {
        this.success = success;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public String getToken() {
        return token;
    }
    
    public void setToken(String token) {
        this.token = token;
    }
    
    public String getUserType() {
        return userType;
    }
    
    public void setUserType(String userType) {
        this.userType = userType;
    }
    
    public String getNickname() {
        return nickname;
    }
    
    public void setNickname(String nickname) {
        this.nickname = nickname;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
}


