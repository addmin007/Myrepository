package com.consultationtool.model.dto;

public class QRCodeStatusResponse {
    
    private boolean success;
    private String message;
    private String status; // pending, scanned, expired, used
    private String token;
    private String userType;
    private String nickname;
    private String username;
    
    // 构造函数
    public QRCodeStatusResponse() {}
    
    public QRCodeStatusResponse(boolean success, String message, String status) {
        this.success = success;
        this.message = message;
        this.status = status;
    }
    
    public QRCodeStatusResponse(boolean success, String message, String status, String token, String userType, String nickname, String username) {
        this.success = success;
        this.message = message;
        this.status = status;
        this.token = token;
        this.userType = userType;
        this.nickname = nickname;
        this.username = username;
    }
    
    // 静态工厂方法
    public static QRCodeStatusResponse pending() {
        return new QRCodeStatusResponse(true, "等待扫码", "pending");
    }
    
    public static QRCodeStatusResponse scanned() {
        return new QRCodeStatusResponse(true, "已扫码，等待确认", "scanned");
    }
    
    public static QRCodeStatusResponse expired() {
        return new QRCodeStatusResponse(false, "二维码已过期", "expired");
    }
    
    public static QRCodeStatusResponse used() {
        return new QRCodeStatusResponse(false, "二维码已使用", "used");
    }
    
    public static QRCodeStatusResponse success(String token, String userType, String nickname, String username) {
        return new QRCodeStatusResponse(true, "登录成功", "success", token, userType, nickname, username);
    }
    
    public static QRCodeStatusResponse failure(String message) {
        return new QRCodeStatusResponse(false, message, "error");
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
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
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


