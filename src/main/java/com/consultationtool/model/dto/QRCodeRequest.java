package com.consultationtool.model.dto;

import javax.validation.constraints.NotBlank;

public class QRCodeRequest {
    
    @NotBlank(message = "登录类型不能为空")
    private String loginType; // phone, qq, wechat
    
    // 构造函数
    public QRCodeRequest() {}
    
    public QRCodeRequest(String loginType) {
        this.loginType = loginType;
    }
    
    // Getter和Setter方法
    public String getLoginType() {
        return loginType;
    }
    
    public void setLoginType(String loginType) {
        this.loginType = loginType;
    }
}


