package com.consultationtool.model.dto;

public class QRCodeResponse {
    
    private boolean success;
    private String message;
    private String qrCodeId;
    private String qrCodeImage; // Base64编码的二维码图片
    private String qrCodeData; // 二维码数据
    
    // 构造函数
    public QRCodeResponse() {}
    
    public QRCodeResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
    
    public QRCodeResponse(boolean success, String message, String qrCodeId, String qrCodeImage, String qrCodeData) {
        this.success = success;
        this.message = message;
        this.qrCodeId = qrCodeId;
        this.qrCodeImage = qrCodeImage;
        this.qrCodeData = qrCodeData;
    }
    
    // 静态工厂方法
    public static QRCodeResponse success(String qrCodeId, String qrCodeImage, String qrCodeData) {
        return new QRCodeResponse(true, "二维码生成成功", qrCodeId, qrCodeImage, qrCodeData);
    }
    
    public static QRCodeResponse failure(String message) {
        return new QRCodeResponse(false, message);
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
    
    public String getQrCodeId() {
        return qrCodeId;
    }
    
    public void setQrCodeId(String qrCodeId) {
        this.qrCodeId = qrCodeId;
    }
    
    public String getQrCodeImage() {
        return qrCodeImage;
    }
    
    public void setQrCodeImage(String qrCodeImage) {
        this.qrCodeImage = qrCodeImage;
    }
    
    public String getQrCodeData() {
        return qrCodeData;
    }
    
    public void setQrCodeData(String qrCodeData) {
        this.qrCodeData = qrCodeData;
    }
}


